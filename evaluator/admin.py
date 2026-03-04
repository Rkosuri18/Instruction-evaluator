from django.contrib import admin
from django.http import HttpResponse
from django.utils.safestring import mark_safe
import json
import re
from .models import EvaluationResult


DOMAIN_CONFIG = {
    "cooking": {
        "lambda": 0.5,
        "ranks": ["parameter", "atomic", "verification", "sensory", "goal", "resumability", "consistency"]
    },
    "assembly": {
        "lambda": 0.5,
        "ranks": ["sensory", "verification", "parameter", "goal", "atomic", "consistency", "resumability"]
    },
    "learning": {
        "lambda": 0.5,
        "ranks": ["goal", "sensory", "verification", "atomic", "parameter", "resumability", "consistency"]
    },
    "software": {
        "lambda": 0.5,
        "ranks": ["consistency", "goal", "parameter", "resumability", "verification", "atomic", "sensory"]
    },
    "other": {
        "lambda": 0.5,
        "ranks": ["goal", "atomic", "sensory", "parameter", "verification", "resumability", "consistency"]
    }
}

def get_geometric_weights(domain_name):
    """Calculates the dynamic weights based on the mentor's geometric decay formula."""
    config = DOMAIN_CONFIG.get(domain_name, DOMAIN_CONFIG["other"])
    lam = config["lambda"]
    ranks = config["ranks"]
    
    
    denominator = sum([lam**j for j in range(7)])
    
    weights = {}
    for idx, dim in enumerate(ranks):
        weights[dim] = (lam**idx) / denominator
    return weights


@admin.action(description="Download as Pipeline JSON")
def export_pipeline_format(modeladmin, request, queryset):
    if not queryset.exists():
        return HttpResponse("No evaluations selected.", status=400)
        
    eval_obj = queryset.first()
    data = eval_obj.evaluation_data
    
    doc_id = eval_obj.document_title.replace(" ", "_").lower()
    domain = eval_obj.domain
    
    steps_list = []
    steps_data = data.get('steps', {})
    for i, (_, step_info) in enumerate(steps_data.items(), 1):
        raw_text = step_info.get('text', '')
        clean_text = re.sub(r'^step\s*\d+[:\.\-]?\s*', '', raw_text, flags=re.IGNORECASE)
        steps_list.append(f"Step {i}: {clean_text}")
        
    solver_input_dict = {
        "doc_id": doc_id,
        "domain": domain,
        "steps": steps_list
    }
    
    
    goal_sum = 0
    params_sum = 0
    act_sum = 0
    select_sum = 0
    fb_sum = 0
    num_steps = len(steps_data)
    
    step_score = {}
    for i, (step_key, step_info) in enumerate(steps_data.items(), 1):
        goal = step_info.get('goal_clarity', {})
        act = step_info.get('atomic_actions', {})
        sensory = step_info.get('sensory_conversion', {})
        params = step_info.get('parameter_boundedness', {})
        verify = step_info.get('verification', {})
        
        v_values = verify.get('values', ['False', 'False', 'False'])
        if len(v_values) < 3: 
            v_values = (v_values + ['False', 'False', 'False'])[:3]
        
        val_goal = str(goal.get('value', 'False'))
        val_act = str(act.get('value', '0'))
        val_sensory = str(sensory.get('value', '0'))
        val_params = str(params.get('rating', '1'))

        
        if val_goal == 'True':
            goal_sum += 1.0
        act_sum += float(val_act)
        select_sum += float(val_sensory)
        params_sum += (float(val_params) - 1) / 4.0
        
        step_fb_val = sum([1.0 if v == 'True' else 0.0 for v in v_values]) / 3.0
        fb_sum += step_fb_val

        step_score[str(i)] = {
            "step_text": step_info.get('text', ''),
            "phi_goal": {
                "value": val_goal,
                "cot": goal.get('reason', '')
            },
            "phi_act": {
                "value": [val_act], 
                "cot": act.get('reason', '')
            },
            "phi_select_spans": {
                "value": [val_sensory], 
                "cot": sensory.get('reason', '')
            },
            "phi_params": {
                "value": str(params.get('rating', '')),
                "cot": params.get('reason', '')
            },
            "phi_fb": {
                "value": {
                    "stop_condition": str(v_values[0]),
                    "verification": str(v_values[1]),
                    "recovery": str(v_values[2])
                },
                "cot": verify.get('reason', '')
            }
        }

    
    mean_goal = goal_sum / num_steps if num_steps else 0
    mean_params = params_sum / num_steps if num_steps else 0
    mean_fb = fb_sum / num_steps if num_steps else 0
    mean_act = act_sum / num_steps if num_steps else 0
    mean_select = select_sum / num_steps if num_steps else 0

    
    guide_data = data.get('guide_level', {})
    resumability = guide_data.get('resumability', {})
    consistency = guide_data.get('consistency', {})

    res_raw = float(resumability.get('rating', 1))
    s_resume = (res_raw - 1) / 4.0
    s_ref = 1.0 if consistency.get('rating', '') == 'Pass' else 0.0

    
    weights = get_geometric_weights(domain)
    
    s_step = (weights["goal"] * mean_goal) + \
             (weights["parameter"] * mean_params) + \
             (weights["verification"] * mean_fb) + \
             (weights["atomic"] * mean_act) + \
             (weights["sensory"] * (1.0 - mean_select))

    s_doc = (weights["resumability"] * s_resume) + \
            (weights["consistency"] * s_ref)

    final_score = s_step + s_doc

    doc_level_score = {
        "resumability": {
            "value": str(int(res_raw)),
            "cot": resumability.get('reason', '')
        },
        "reference_consistency": {
            "value": str(consistency.get('rating', '')),
            "cot": consistency.get('reason', '')
        }
    }

    
    
    cot_doc = (
        "Document-level aggregation pipeline.\\n\\n"
        f"A) Normalize doc metrics to [0,1]: resumability (1–5) with value={int(res_raw)} → S_resume=({int(res_raw)}-1)/(5-1)={s_resume:.1f}. "
        f"reference_consistency Pass/Fail with Pass→S_ref={s_ref:.1f}.\\n\\n"
        "B) Importance ranking (most→least): reference_consistency=r1, resumability=r2.\\n\\n"
        "C) Weight decay with λ=0.5: unnormalized [1.0, 0.6065]. Normalize (sum=1.6065) → [0.6225, 0.3775].\\n\\n"
        f"D) Weighted sum: S_doc = 0.6225*{s_ref:.1f} + 0.3775*{s_resume:.1f} = {s_doc:.4f}."
    )

    
    cot_final = (
        "Final score mixing step-level and document-level aggregates.\\n\\n"
        f"Let S_step={s_step:.4f} and S_doc={s_doc:.4f}. Use α=0.8 so step-level dominates (execution-critical). "
        f"Overall = α*S_step + (1-α)*S_doc = 0.8*{s_step:.4f} + 0.2*{s_doc:.4f} = {final_score:.4f}."
    )

    lam_val = DOMAIN_CONFIG.get(domain, DOMAIN_CONFIG["other"])["lambda"]
    
    solution = {
        "step_score": step_score,
        "step_level_score_calc": {
            "value": f"{s_step:.4f}",
            "cot": f"Step-level aggregation calculated using geometric decay (lambda={lam_val})."
        },
        "doc_level_score": doc_level_score,
        "doc_level_score_calc": {
            "value": f"{s_doc:.4f}",
            "cot": cot_doc
        },
        "final_overall_score": {
            "value": f"{final_score:.4f}",
            "cot": cot_final
        }
    }

    solver_output_dict = {
        "response": [
            {
                "domain": [domain],
                "solution": solution
            }
        ]
    }

    input_json_str = json.dumps(solver_input_dict, indent=2, ensure_ascii=False)
    output_json_str = json.dumps(solver_output_dict, indent=2, ensure_ascii=False)
    
    input_json_str = input_json_str.replace('"domain":', '"domain" :')
    input_json_str = re.sub(r'\"\n  \]', '",\n        \n  ]', input_json_str)
    
    input_json_str = input_json_str.replace('{', '{{').replace('}', '}}')
    output_json_str = output_json_str.replace('{', '{{').replace('}', '}}')
    
    input_json_str = re.sub(r'\[\s*"([^"]*)"\s*\]', r'["\1"]', input_json_str)
    output_json_str = re.sub(r'\[\s*"([^"]*)"\s*\]', r'["\1"]', output_json_str)
    
    final_text = f'solver_input = """ \n{input_json_str}\n\n"""\n\nsolver_output = """\n{output_json_str} \n"""\n'

    response = HttpResponse(final_text, content_type="text/plain; charset=utf-8")
    response['Content-Disposition'] = f'attachment; filename="{doc_id}.json"'
    return response

class EvaluationResultAdmin(admin.ModelAdmin):
    list_display = ('document_title', 'domain', 'created_at') 
    list_filter = ('domain',)                                
    search_fields = ('document_title',)                       
    actions = [export_pipeline_format]                         
    readonly_fields = ('created_at', 'answer_table')
    
    fieldsets = (
        ('Document Info', {
            'fields': ('document_title', 'domain', 'created_at')
        }),
        ('Raw JSON Data', {
            'fields': ('evaluation_data',),
            'classes': ('collapse',) 
        }),
        ('Evaluations Overview', {
            'fields': ('answer_table',)
        }),
    )

    def answer_table(self, obj):
        if not obj.evaluation_data:
            return "No data available."
        
        html = """
        <table style="width: 100%; border-collapse: collapse; text-align: left; background-color: white;">
            <tr style="background-color: #f2f2f2;">
                <th style="border: 1px solid #ddd; padding: 8px;">Section</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Dimension</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Value / Rating</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Reason (COT)</th>
            </tr>
        """
        
        data = obj.evaluation_data
        
        steps = data.get('steps', {})
        for step_key, step_data in steps.items():
            dimensions = ['goal_clarity', 'atomic_actions', 'sensory_conversion', 'parameter_boundedness', 'verification']
            for dim in dimensions:
                dim_data = step_data.get(dim, {})
                reason = dim_data.get('reason', '-')
                
                if 'values' in dim_data and isinstance(dim_data['values'], list):
                    rating = f"{dim_data['values'][0]} | {dim_data['values'][1]} | {dim_data['values'][2]}"
                else:
                    rating = dim_data.get('rating', dim_data.get('value', '-'))
                
                clean_dim_name = dim.replace('_', ' ').title()
                
                html += f"""
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">{step_key.replace('_', ' ').title()}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">{clean_dim_name}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;"><b>{rating}</b></td>
                    <td style="border: 1px solid #ddd; padding: 8px;">{reason}</td>
                </tr>
                """
                
        guide = data.get('guide_level', {})
        for dim, dim_data in guide.items():
            rating = dim_data.get('rating', '-')
            reason = dim_data.get('reason', '-')
            clean_dim_name = dim.replace('_', ' ').title()
            
            html += f"""
            <tr style="background-color: #e8f4f8;">
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Guide Level</td>
                <td style="border: 1px solid #ddd; padding: 8px;">{clean_dim_name}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;"><b>{rating}</b></td>
                <td style="border: 1px solid #ddd; padding: 8px;">{reason}</td>
            </tr>
            """
            
        html += "</table>"
        return mark_safe(html)
        
    answer_table.short_description = "Detailed Answer Table"

admin.site.register(EvaluationResult, EvaluationResultAdmin)