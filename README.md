# Instruction Evaluation Portal

This is a Django-based web application designed for researchers to annotate, evaluate, and score step-by-step instructional guides. The tool is built to handle instructions across four specific domains: cooking, assembly, learning to use a product, and software tutorials.

## Key Features

* **Step-by-Step Annotation UI:** A structured interface that allows evaluators to grade individual instruction steps across 5 core dimensions:
  * Goal/Outcome Clarity
  * Atomic Actions
  * Sensory Conversion
  * Parameter Boundedness
  * Verification Feedback & Recovery
* **Document-Level Review:** Evaluates the guide as a whole for Resumability and Cross-step Reference Consistency.
* **Automated Scoring:** Calculates aggregate step-level and document-level metrics based on the project's current weighting model.
* **Pipeline-Ready JSON Export:** Includes a custom Django admin action that compiles the evaluations, calculates final scores, and exports a heavily formatted JSON file.

## How to Run This on Your Machine

1. **Clone the repository:**
   `git clone https://github.com/Rkosuri18/Instruction-evaluator`
   `cd Instruction-evaluator`

2. **Create and activate a virtual environment:**
   `python -m venv venv`
   * On Windows: `venv\Scripts\activate`
   * On Mac/Linux: `source venv/bin/activate`

3. **Install the dependencies:**
   `pip install -r requirements.txt`

4. **Set up the database:**
   `python manage.py migrate`

5. **Run the local server:**
   `python manage.py runserver`

6. **Open your browser:**
   Go to `http://127.0.0.1:8000`