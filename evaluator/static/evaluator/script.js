let steps = [];
let currentStepIndex = 0;
let documentTitle = "";
let documentDomain = "";
let finalPayload = { steps: {}, guide_level: {} };
const dimensionNames = ["Goal/Outcome Clarity", "Atomic Actions", "Sensory Conversion", "Parameter Boundedness", "Verification Feedback & Recovery"];

const domainConfig = {
    "cooking": {
        lambda: 0.5,
        ranks: ["parameter", "atomic", "verification", "sensory", "goal", "resumability", "consistency"]
    },
    "assembly": {
        lambda: 0.5,
        ranks: ["sensory", "verification", "parameter", "goal", "atomic", "consistency", "resumability"]
    },
    "learning": { 
        lambda: 0.5,
        ranks: ["goal", "sensory", "verification", "atomic", "parameter", "resumability", "consistency"]
    },
    "software": { 
        lambda: 0.5,
        ranks: ["consistency", "goal", "parameter", "resumability", "verification", "atomic", "sensory"]
    },
    "other": {
        lambda: 0.5,
        ranks: ["goal", "atomic", "sensory", "parameter", "verification", "resumability", "consistency"]
    }
};


function calculateGeometricWeights(domain) {
    let config = domainConfig[domain] || domainConfig["other"];
    let lambda = config.lambda;
    let ranks = config.ranks;

    let denominator = 0;
    for (let j = 1; j <= 7; j++) {
        denominator += Math.pow(lambda, j - 1); 
    }

    let weights = {};
    ranks.forEach((dimName, index) => {
        let r = index + 1; 
        let numerator = Math.pow(lambda, r - 1);
        weights[dimName] = numerator / denominator; 
    });

    return weights;
}

function showCustomAlert(message, isError = true) {
    const alertBox = document.getElementById('customAlert');
    alertBox.innerText = message;
    if (isError) { alertBox.className = 'custom-alert error show'; } 
    else { alertBox.className = 'custom-alert success show'; }
    setTimeout(() => { alertBox.classList.remove('show'); }, 3000);
}

window.onload = function() {
    if (localStorage.getItem('evaluatorState')) {
        document.getElementById('resumeBtn').classList.remove('hidden');
    }
};

function saveProgress() {
    const state = { steps, currentStepIndex, finalPayload, documentTitle, documentDomain };
    localStorage.setItem('evaluatorState', JSON.stringify(state));
}

function resumeEvaluation() {
    const state = JSON.parse(localStorage.getItem('evaluatorState'));
    steps = state.steps; currentStepIndex = state.currentStepIndex;
    finalPayload = state.finalPayload; documentTitle = state.documentTitle; documentDomain = state.documentDomain;

    document.getElementById('instructionTitle').value = documentTitle;
    document.getElementById('instructionDomain').value = documentDomain;
    document.getElementById('rawInstructions').value = steps.join('\n');

    document.getElementById('phase1').classList.add('hidden');
    if (currentStepIndex < steps.length) {
        document.getElementById('phase2').classList.remove('hidden'); renderStep();
    } else { document.getElementById('phase3').classList.remove('hidden'); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startEvaluation() {
    documentDomain = document.getElementById('instructionDomain').value;
    documentTitle = document.getElementById('instructionTitle').value.trim();
    const rawText = document.getElementById('rawInstructions').value;

    if (!documentDomain) { showCustomAlert("Please select a Domain.", true); return; }
    if (!documentTitle) { showCustomAlert("Please enter a Title.", true); return; }
    
    steps = rawText.split('\n').filter(line => line.trim() !== ''); 
    if (steps.length === 0) { showCustomAlert("Please paste instructions first.", true); return; }

    localStorage.removeItem('evaluatorState');
    currentStepIndex = 0; finalPayload = { steps: {}, guide_level: {} };

    document.getElementById('phase1').classList.add('hidden');
    document.getElementById('phase2').classList.remove('hidden');
    renderStep(); saveProgress(); window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToPhase1() {
    document.getElementById('phase2').classList.add('hidden');
    document.getElementById('phase1').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderStep() {
    document.getElementById('progressBar').style.width = ((currentStepIndex / steps.length) * 100) + '%';
    document.getElementById('stepHeader').innerText = "Step " + (currentStepIndex + 1) + " of " + steps.length;
    document.getElementById('stepText').innerText = steps[currentStepIndex];
    
    if (currentStepIndex === 0) {
        document.getElementById('backToSetupBtn').classList.remove('hidden');
        document.getElementById('backBtn').classList.add('hidden');
    } else {
        document.getElementById('backToSetupBtn').classList.add('hidden');
        document.getElementById('backBtn').classList.remove('hidden');
    }

    let stepKey = "step_" + (currentStepIndex + 1);
    let savedData = finalPayload.steps[stepKey];

    if (savedData) {
        
        document.getElementById('dim1_rating').value = savedData.goal_clarity.value !== undefined ? savedData.goal_clarity.value : '';
        document.getElementById('dim1_reason').value = savedData.goal_clarity.reason || '';
        
        document.getElementById('dim2_value').value = savedData.atomic_actions.value !== undefined ? savedData.atomic_actions.value : '';
        document.getElementById('dim2_reason').value = savedData.atomic_actions.reason || '';
        
        document.getElementById('dim3_value').value = savedData.sensory_conversion.value !== undefined ? savedData.sensory_conversion.value : '';
        document.getElementById('dim3_reason').value = savedData.sensory_conversion.reason || '';
        
        document.getElementById('dim4_rating').value = savedData.parameter_boundedness.rating || '';
        document.getElementById('dim4_reason').value = savedData.parameter_boundedness.reason || '';
        
        let v5 = savedData.verification.values || [];
        document.getElementById('dim5_value1').value = v5[0] !== undefined ? v5[0] : '';
        document.getElementById('dim5_value2').value = v5[1] !== undefined ? v5[1] : '';
        document.getElementById('dim5_value3').value = v5[2] !== undefined ? v5[2] : '';
        document.getElementById('dim5_reason').value = savedData.verification.reason || '';
    } else {
        document.getElementById('dim1_rating').value = ''; document.getElementById('dim1_reason').value = '';
        document.getElementById('dim2_value').value = ''; document.getElementById('dim2_reason').value = '';
        document.getElementById('dim3_value').value = ''; document.getElementById('dim3_reason').value = '';
        document.getElementById('dim4_rating').value = ''; document.getElementById('dim4_reason').value = '';
        document.getElementById('dim5_value1').value = ''; 
        document.getElementById('dim5_value2').value = ''; 
        document.getElementById('dim5_value3').value = ''; 
        document.getElementById('dim5_reason').value = '';
    }
}

function prevStep() {
    if (currentStepIndex > 0) {
        currentStepIndex--; renderStep(); saveProgress();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function backToPhase2() {
    document.getElementById('phase3').classList.add('hidden');
    document.getElementById('phase2').classList.remove('hidden');
    currentStepIndex = steps.length - 1; renderStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() {
    
    const singleInputs = [
        { valId: 'dim1_rating', resId: 'dim1_reason', name: dimensionNames[0], isRating: false },
        { valId: 'dim2_value', resId: 'dim2_reason', name: dimensionNames[1], isRating: false },
        { valId: 'dim3_value', resId: 'dim3_reason', name: dimensionNames[2], isRating: false },
        { valId: 'dim4_rating', resId: 'dim4_reason', name: dimensionNames[3], isRating: true }
    ];

    for (let i = 0; i < singleInputs.length; i++) {
        let valEl = document.getElementById(singleInputs[i].valId);
        let resEl = document.getElementById(singleInputs[i].resId);
        if (!valEl.value) { 
            let typeStr = singleInputs[i].isRating ? "rating" : "value";
            showCustomAlert(`You missed the ${typeStr} for: ${singleInputs[i].name}`, true); return; 
        }
        if (!resEl.value.trim()) { showCustomAlert(`You missed the reason for: ${singleInputs[i].name}`, true); return; }
    }

    let v1 = document.getElementById('dim5_value1').value;
    let v2 = document.getElementById('dim5_value2').value;
    let v3 = document.getElementById('dim5_value3').value;
    let r5 = document.getElementById('dim5_reason').value;

    if (!v1 || !v2 || !v3) {
        showCustomAlert("You missed one or more True/False results for: Verification Feedback & Recovery", true); return;
    }
    if (!r5.trim()) {
        showCustomAlert("You missed the reason for: Verification Feedback & Recovery", true); return;
    }

    
    finalPayload.steps["step_" + (currentStepIndex + 1)] = {
        text: steps[currentStepIndex],
        goal_clarity: { value: document.getElementById('dim1_rating').value, reason: document.getElementById('dim1_reason').value },
        atomic_actions: { value: parseFloat(document.getElementById('dim2_value').value), reason: document.getElementById('dim2_reason').value },
        sensory_conversion: { value: parseFloat(document.getElementById('dim3_value').value), reason: document.getElementById('dim3_reason').value },
        parameter_boundedness: { rating: document.getElementById('dim4_rating').value, reason: document.getElementById('dim4_reason').value },
        verification: { 
            values: [v1, v2, v3],
            reason: r5 
        }
    };

    currentStepIndex++; saveProgress(); 

    if (currentStepIndex < steps.length) { renderStep(); } 
    else { document.getElementById('phase2').classList.add('hidden'); document.getElementById('phase3').classList.remove('hidden'); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function submitData() {
    let guide1Rating = document.getElementById('guide1_rating').value;
    let guide2Rating = document.getElementById('guide2_rating').value;

    if(!guide1Rating || !document.getElementById('guide1_reason').value.trim()) {
        showCustomAlert("Please provide both a rating and reason for Resumability.", true); return;
    }
    if(!guide2Rating || !document.getElementById('guide2_reason').value.trim()) {
        showCustomAlert("Please provide both a Pass/Fail result and reason for Cross-step Consistency.", true); return;
    }

    finalPayload.guide_level = {
        resumability: { rating: guide1Rating, reason: document.getElementById('guide1_reason').value },
        consistency: { rating: guide2Rating, reason: document.getElementById('guide2_reason').value }
    };

    
    let paramsSum = 0, actSum = 0, selectSum = 0, fbSum = 0, goalSum = 0;
    let numSteps = Object.keys(finalPayload.steps).length;

    for (const key in finalPayload.steps) {
        let step = finalPayload.steps[key];
        
        
        let gVal = (step.goal_clarity.value === "True") ? 1.0 : 0.0;
        goalSum += gVal;

        
        actSum += parseFloat(step.atomic_actions.value) || 0;

        
        selectSum += parseFloat(step.sensory_conversion.value) || 0;

        
        let pRating = parseFloat(step.parameter_boundedness.rating) || 1;
        paramsSum += (pRating - 1) / 4.0;
        
        
        let fbVal = 0;
        if (step.verification.values[0] === "True") fbVal += 1;
        if (step.verification.values[1] === "True") fbVal += 1;
        if (step.verification.values[2] === "True") fbVal += 1;
        fbSum += (fbVal / 3.0);
    }

    
    let scores = {
        "goal": goalSum / numSteps,
        "atomic": actSum / numSteps,
        "sensory": 1.0 - (selectSum / numSteps), 
        "parameter": paramsSum / numSteps,
        "verification": fbSum / numSteps,
        "resumability": (parseFloat(guide1Rating) - 1) / 4.0,
        "consistency": (guide2Rating === "Pass") ? 1.0 : 0.0
    };

   
    let weights = calculateGeometricWeights(documentDomain);

    
    let sStep = (weights["goal"] * scores["goal"]) + 
                (weights["atomic"] * scores["atomic"]) + 
                (weights["sensory"] * scores["sensory"]) + 
                (weights["parameter"] * scores["parameter"]) + 
                (weights["verification"] * scores["verification"]);

    let sDoc = (weights["resumability"] * scores["resumability"]) + 
               (weights["consistency"] * scores["consistency"]);

    let finalScore = sStep + sDoc; 

    document.getElementById('resStepScore').innerText = sStep.toFixed(4);
    document.getElementById('resDocScore').innerText = sDoc.toFixed(4);
    document.getElementById('resFinalScore').innerText = finalScore.toFixed(4);
   

    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    
    let submitBtn = event.target;
    let originalText = submitBtn.innerText;
    submitBtn.innerText = "Saving to Database...";
    submitBtn.disabled = true;

    fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify({ title: documentTitle, domain: documentDomain, payload: finalPayload })
    }).then(response => {
        if (response.ok) {
            localStorage.removeItem('evaluatorState'); 
            
            document.getElementById('phase3').classList.add('hidden');
            document.getElementById('phase4').classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
        } else { 
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
            showCustomAlert("Error saving data to the database.", true); 
        }
    });
}