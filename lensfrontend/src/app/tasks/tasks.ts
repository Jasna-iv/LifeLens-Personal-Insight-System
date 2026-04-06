import { Component, OnInit ,ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';

interface Todo {
  id: number;
  task: string;        // keep same (UI uses this)
  completed: boolean;
  deleted: boolean; 
  selected?: boolean;    // keep recycle feature
    date?: string; 
}

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './tasks.html',
  styleUrls: ['./tasks.css']
})
export class TasksComponent implements OnInit {

  todos: Todo[] = [];
  newTask = '';
  selectedToDelete: number[] = []; // store ids of selected tasks
  allSelected = false;             // track select all checkbox

  API_URL = 'http://127.0.0.1:8000';

  activeBox: 'completed' | 'incompleted' | 'recycle' | null = null;
  menuOpen = false;
  recycleOpen = false;

  selectAll = false;
  taskDate: string = '';   // ✅ ADD THIS

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef,private router: Router) {}

  ngOnInit() {
    if (localStorage.getItem('isLoggedIn') !== 'true') {
      window.location.href = 'login.html';
    }
    this.loadTodos();
  }
// TrackBy function for ngFor
trackById(index: number, item: Todo) {
  return item.id;
}
  // ---------------- LOAD TODOS ----------------
loadTodos() {
  this.http.get<any[]>(`${this.API_URL}/tasks/`)
    .subscribe({
      next: (data) => {
        this.todos = (data || []).map(t => ({
          id: t.id,
          task: t.title,
          completed: t.completed,
          deleted: t.deleted,
          date: t.date ? new Date(t.date).toISOString() : undefined  // ✅ convert to ISO string
        }));

        this.cdr.detectChanges();
      },
      error: (err) => console.error(err)
    });
}

  // ---------------- COUNTS (reactive getters) ----------------
  get totalTasks(): number {
    return this.todos.filter(t => !t.deleted).length;
  }

  get completedTasks(): number {
    return this.todos.filter(t => t.completed && !t.deleted).length;
  }

  get pendingTasks(): number {
    return this.todos.filter(t => !t.completed && !t.deleted).length;
  }

  // ---------------- ADD TASK ----------------
addTask() {
  const taskText = this.newTask.trim();
  if (!taskText) return;

  this.newTask = '';

  this.http.post<any>(`${this.API_URL}/add-task/`, { title: taskText, date: this.taskDate || null })
    .subscribe(res => {
      this.todos.push({
        id: res.id,
        task: res.title,
        completed: res.completed,
        deleted: false,
        date: res.date ? new Date(res.date).toISOString() : undefined  // ✅ convert here too
      });

      this.cdr.detectChanges();
    });
}

  // ---------------- COMPLETE TASK ----------------
  completeTask(todo: Todo) {
    if (!todo.completed) {
      todo.completed = true;

      this.http.patch(`${this.API_URL}/tasks/${todo.id}/`, {
        completed: true
      }).subscribe();
    }
  }

  // ---------------- SOFT DELETE ----------------
  deleteTask(todo: Todo) {
    todo.deleted = true;

    this.http.delete(`${this.API_URL}/delete_task/${todo.id}/`).subscribe({
      next: () => console.log('Moved to recycle bin (removed from backend)'),
      error: err => console.error(err)
    });
  }

  // ---------------- RESTORE TASK ----------------
 restoreTask(todo: Todo) {
  todo.deleted = false;

  this.http.post(`${this.API_URL}/add-task/`, { title: todo.task, date: todo.date || null }).subscribe({
    next: (res: any) => {
      todo.id = res.id;
      todo.completed = res.completed;
      todo.date = res.date ? new Date(res.date).toISOString() : undefined; // ✅ normalize
      console.log('Restored to backend');
    },
    error: err => console.error(err)
  });
}

  // ---------------- PERMANENT DELETE ----------------
  permanentDelete(todo: Todo) {
    if (!confirm('Are you sure?')) return;

    this.todos = this.todos.filter(t => t.id !== todo.id);

    this.http.delete(`${this.API_URL}/delete_task/${todo.id}/`).subscribe({
      next: () => console.log('Permanently deleted'),
      error: err => console.error(err)
    });
  }

  // ---------------- TOGGLE SELECT ----------------
  toggleSelect(todo: Todo) {
    if (todo.selected) {
      this.selectedToDelete.push(todo.id);
    } else {
      this.selectedToDelete = this.selectedToDelete.filter(id => id !== todo.id);
      this.allSelected = false;
    }
  }

  toggleSelectAll() {
    this.recycledTodos.forEach(t => t.selected = this.selectAll);
  }

  hasSelected() {
    return this.recycledTodos.some(t => t.selected);
  }

  deleteSelected() {
    const selectedTasks = this.recycledTodos.filter(t => t.selected);
    if (selectedTasks.length === 0) return;

    if (!confirm(`Are you sure you want to permanently delete ${selectedTasks.length} task(s)?`)) return;

    selectedTasks.forEach(t => {
      this.todos = this.todos.filter(td => td.id !== t.id);
      this.http.delete(`${this.API_URL}/delete_task/${t.id}/`).subscribe();
    });

    this.selectAll = false;
  }

  deleteSelectedPermanently() {
    if (!confirm('Are you sure you want to permanently delete the selected tasks?')) return;

    const tasksToDelete = [...this.selectedToDelete];
    this.todos = this.todos.filter(t => !tasksToDelete.includes(t.id));
    this.selectedToDelete = [];

    tasksToDelete.forEach(id => {
      this.http.delete(`${this.API_URL}/delete_task/${id}/`).subscribe({
        next: () => console.log(`Task ${id} permanently deleted`),
        error: err => console.error(err)
      });
    });
  }

  // ---------------- UI LOGIC ----------------
  toggleMenu(event: Event) {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  openBox(type: 'completed' | 'incompleted' | 'recycle') {
    this.activeBox = type;
  }

  closeAll() {
    this.menuOpen = false;
    this.activeBox = null;
  }

  showRecycle(event: Event) {
    event.stopPropagation();
    this.recycleOpen = true;
    this.menuOpen = false;
  }

  showCompleted(event: Event) {
    event.stopPropagation();
    this.recycleOpen = false;
    this.menuOpen = false;
  }

  showIncomplete(event: Event) {
    event.stopPropagation();
    this.recycleOpen = false;
    this.menuOpen = false;
  }

  logout() {
    localStorage.removeItem('isLoggedIn');
    window.location.href = '';
  }


  // ---------------- FILTERS ----------------
  get activeTodos() {
    return this.todos.filter(t => !t.deleted);
  }

  get completedTodos() {
    return this.todos.filter(t => t.completed && !t.deleted);
  }

  get incompletedTodos() {
    return this.todos.filter(t => !t.completed && !t.deleted);
  }

  get recycledTodos() {
    return this.todos.filter(t => t.deleted);
  }

  goToDashboard() {
    window.location.href = '/dashboard/';
  }
    goToExpenses() {
  this.router.navigate(['/expenses']);
}
}