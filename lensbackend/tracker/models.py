from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
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
    
class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    bio = models.TextField(blank=True)
    profile_pic = models.ImageField(upload_to='profile_pics/', blank=True, null=True)

    def __str__(self):
        return self.user.username
    
@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

class Document(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)

    title = models.CharField(max_length=255)
    file = models.FileField(upload_to='documents/')
    doc_type = models.CharField(max_length=50, blank=True)

    # ✅ NEW FEATURES
    folder = models.CharField(max_length=255, blank=True, null=True)
    deleted = models.BooleanField(default=False)
    shared = models.BooleanField(default=False)
    starred = models.BooleanField(default=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title
    
