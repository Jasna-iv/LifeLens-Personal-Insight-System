import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';

interface Todo {
  id: number;
  task: string;
  completed: boolean;
  deleted: boolean;
  selected?: boolean;
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
  taskDate: string = '';

  selectedToDelete: number[] = [];

  API_URL = 'http://localhost:8000';

  activeBox: 'completed' | 'incompleted' | 'recycle' | null = null;
  menuOpen = false;
  recycleOpen = false;

  selectAll = false;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit() {
    const loggedIn = localStorage.getItem('isLoggedIn');

    if (loggedIn !== 'true') {
      this.router.navigate(['/login']);
      return;
    }

    this.loadTodos();
  }

  // ---------------- TRACK BY FIX ----------------
  trackById(index: number, item: Todo): number {
    return item.id;
  }

  // ---------------- LOAD ----------------
  loadTodos() {
    this.http.get<any>(`${this.API_URL}/tasks/`, { withCredentials: true })
      .subscribe({
        next: (data) => {

          const list = Array.isArray(data) ? data : [];

          this.todos = list.map((t: any) => ({
            id: t.id,
            task: t.title || t.task,
            completed: t.completed,
            deleted: t.deleted,
            date: t.date ? new Date(t.date).toISOString() : undefined
          }));

          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error("LOAD TASK ERROR:", err);
          this.todos = [];
        }
      });
  }

  // ---------------- ADD TASK ----------------
  addTask() {
  console.log("Add button clicked:", this.newTask);
  if (!this.newTask.trim()) return;
  const taskText = this.newTask.trim();
  if (!taskText) return;

  const payload = {
    title: taskText,
    date: this.taskDate || null
  };

  console.log("Adding task payload:", payload);

  this.http.post<any>(`${this.API_URL}/add-task/`, payload, { withCredentials: true })
    .subscribe({
      next: (res) => {
        console.log("Add task response:", res);
        const newTodo: Todo = {
          id: res.id,
          task: res.title,
          completed: false,
          deleted: false,
          date: res.date ? new Date(res.date).toISOString() : undefined
        };
        this.todos = [newTodo, ...this.todos];
        this.newTask = '';
        this.taskDate = '';
        this.cdr.detectChanges();
      },
      error: (err) => console.error("ADD TASK ERROR:", err)
    });
}

  // ---------------- COMPLETE ----------------
  completeTask(todo: Todo) {
    todo.completed = true;

    this.http.patch(`${this.API_URL}/tasks/${todo.id}/`,
      { completed: true },
      { withCredentials: true }
    ).subscribe();
  }

  // ---------------- DELETE (SOFT) ----------------
  deleteTask(todo: Todo) {
    todo.deleted = true;

    this.http.patch(`${this.API_URL}/tasks/${todo.id}/`,
      { deleted: true },
      { withCredentials: true }
    ).subscribe();
  }

  // ---------------- RESTORE ----------------
  restoreTask(todo: Todo) {
    todo.deleted = false;

    this.http.patch(`${this.API_URL}/tasks/${todo.id}/`,
      { deleted: false },
      { withCredentials: true }
    ).subscribe({
      next: () => this.loadTodos()
    });
  }

  // ---------------- PERMANENT DELETE ----------------
  permanentDelete(todo: Todo) {
    if (!confirm('Are you sure?')) return;

    this.http.delete(`${this.API_URL}/delete_task/${todo.id}/`,
      { withCredentials: true }
    ).subscribe({
      next: () => this.loadTodos()
    });
  }

  // ---------------- SELECT ----------------
  toggleSelect(todo: Todo) {
    todo.selected = !todo.selected;

    if (todo.selected) {
      this.selectedToDelete.push(todo.id);
    } else {
      this.selectedToDelete = this.selectedToDelete.filter(id => id !== todo.id);
    }
  }

  toggleSelectAll() {
    this.recycledTodos.forEach(t => t.selected = this.selectAll);
  }

  hasSelected() {
    return this.recycledTodos.some(t => t.selected);
  }

  deleteSelected() {
    const selected = this.recycledTodos.filter(t => t.selected);

    if (!selected.length) return;
    if (!confirm(`Delete ${selected.length} tasks?`)) return;

    selected.forEach(t => {
      this.http.delete(`${this.API_URL}/delete_task/${t.id}/`,
        { withCredentials: true }
      ).subscribe();
    });

    setTimeout(() => this.loadTodos(), 300);
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

  // ---------------- UI ----------------
  toggleMenu(event: Event) {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
    this.activeBox = null;
  }

  openBox(type: 'completed' | 'incompleted' | 'recycle') {
    this.activeBox = type;
  }

  closeAll() {
    this.menuOpen = false;
    this.activeBox = null;
  }

  // ---------------- NAV ----------------
  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  goToExpenses() {
    this.router.navigate(['/expenses']);
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }

  logout() {
    localStorage.removeItem('isLoggedIn');
    this.router.navigate(['']);
  }
}