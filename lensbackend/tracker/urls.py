from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from .views import (
    dashboard, get_tasks, add_task, update_task, login_view, delete_task,
    get_expenses, add_expense, update_expense, expense_delete,profile_view,change_password,verify_otp,send_otp,signup,
    reset_password,upload_document,list_documents
)
from django.http import HttpResponse

urlpatterns = [
    path('', lambda request: HttpResponse("Backend running")),
    path('login/', login_view),

    # Signup
    path('signup/', signup),

    # Tasks
    path('tasks/', get_tasks),
    path('add-task/', add_task),
    path('tasks/<int:pk>/', update_task),
    path('delete_task/<int:pk>/', delete_task),

    # Expenses
    path('expenses/', get_expenses),
    path('expenses/add/', add_expense),
    path('expenses/<int:id>/update/', update_expense),
    path('expenses/<int:id>/delete/', expense_delete),
    path('profile/', profile_view),
    path('change-password/', change_password),
    path('send-otp/', send_otp),
    path('verify-otp/', verify_otp),
    path('reset-password/', reset_password),

     path('documents/upload/', upload_document),
     path('documents/', list_documents),


]+ static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)