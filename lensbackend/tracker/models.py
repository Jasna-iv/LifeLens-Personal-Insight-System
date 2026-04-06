from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone

class Task(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    completed = models.BooleanField(default=False)
    deleted = models.BooleanField(default=False) 
    created_at = models.DateTimeField(auto_now_add=True)
    date = models.DateField(null=True, blank=True)  # optional user-provided date

    def __str__(self):
        return self.title


class Expense(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    category = models.CharField(max_length=50)
    amount = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)
    deleted = models.BooleanField(default=False)  
    date = models.DateField(default=timezone.now)  

    def __str__(self):
        return f"{self.category}: {self.amount}"