from django.contrib import admin
from .models import Document
from .models import Task

@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'doc_type', 'uploaded_at')
    readonly_fields = ('uploaded_at', 'updated_at')