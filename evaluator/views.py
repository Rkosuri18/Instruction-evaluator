from django.shortcuts import render
from django.http import JsonResponse
import json
from .models import EvaluationResult

def evaluation_ui(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            EvaluationResult.objects.create(
                document_title=data.get('title', 'Untitled'),
                domain=data.get('domain', 'other'),
                evaluation_data=data.get('payload') 
            )
            return JsonResponse({"status": "success"})
        except Exception as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=400)
            
    return render(request, 'evaluator/index.html')