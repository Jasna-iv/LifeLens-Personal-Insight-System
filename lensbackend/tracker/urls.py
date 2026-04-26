from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from .views import (
    dashboard, get_tasks, add_task, update_task, login_view, delete_task,
    get_expenses, add_expense, update_expense, expense_delete,profile_view,change_password,verify_otp,send_otp,signup,
    reset_password,list_documents,upload_document,delete_document,download_document,rename_document,restore_document,permanent_delete,
    share_document,edit_document,toggle_star,get_insights,chat_view,get_csrf
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


    path('documents/', list_documents),
    path('upload/', upload_document),
    path('documents/<int:id>/edit/', edit_document),
    path('documents/<int:id>/delete/', delete_document),
    path('documents/<int:id>/restore/', restore_document),
    path('documents/<int:id>/permanent/', permanent_delete),
    path('documents/<int:id>/download/', download_document),
    path('documents/<int:id>/rename/', rename_document),
    path('documents/<int:id>/share/', share_document),
    path('documents/<int:id>/star/', toggle_star),

    path('insights/', get_insights),
        path('chat/', chat_view),
        path('csrf/', get_csrf),


]+ static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)