from django.db import models

class EvaluationResult(models.Model):
    DOMAIN_CHOICES = [
        ('cooking', 'Cooking'),
        ('assembly', 'Assembly'),
        ('learning', 'Learning to use the product'),
        ('software', 'Software tutorial'),
        ('other', 'Other'),
    ]
    
    document_title = models.CharField(max_length=255)
    domain = models.CharField(max_length=50, choices=DOMAIN_CHOICES, default='other')
    evaluation_data = models.JSONField(help_text="Stores the step and guide evaluation JSON")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.document_title} ({self.get_domain_display()})"
