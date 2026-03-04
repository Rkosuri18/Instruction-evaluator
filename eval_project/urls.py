from django.contrib import admin
from django.urls import path
from evaluator import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.evaluation_ui, name='home'),
]