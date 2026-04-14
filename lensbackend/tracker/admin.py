from django.contrib import admin
from .models import Document
from .models import Task

admin.site.register(Task)
@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):

    list_display = ('id', 'title', 'user', 'doc_type', 'uploaded_at')

    exclude = ('file',)   # 🚫 hide file access

    readonly_fields = ('user', 'uploaded_at')