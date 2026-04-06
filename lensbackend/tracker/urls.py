from django.urls import path
from .views import (
    dashboard, get_tasks, add_task, update_task, login_view, delete_task,
    get_expenses, add_expense, update_expense, expense_delete
)
from django.http import HttpResponse

urlpatterns = [
    path('', lambda request: HttpResponse("Backend running")),
    path('login/', login_view),

    # Tasks
    path('tasks/', get_tasks),
    path('add-task/', add_task),
    path('tasks/<int:pk>/', update_task),
    path('delete_task/<int:pk>/', delete_task),

    # Expenses
    path('expenses/', get_expenses),
    path('expenses/add/', add_expense),
    path('expenses/<int:id>/', update_expense),      # ✅ UPDATE route
    path('expenses/delete/<int:id>/', expense_delete),
]