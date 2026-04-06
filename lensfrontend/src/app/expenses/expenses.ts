import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
 
interface Expense {
  id: number;
  amount: number;
  type: 'Income' | 'Expense';
  category: string;
  date?: string;
}

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, DatePipe],
  templateUrl: './expenses.html',
  styleUrls: ['./expenses.css']
})
export class ExpenseComponent implements OnInit {
  Math = Math;

  expenses: Expense[] = [];
  filteredExpenses: Expense[] = [];
  selectedMonth: string = '';
  selectedType: 'All' | 'Income' | 'Expense' = 'All';

  newExpense: Omit<Expense, 'id'> = { amount: 0, type: 'Expense', category: '', date: '' };
  customCategoryInput: string = '';
  editingExpenseId: number | null = null;
  showCustomCategory = false;

  categories: { [key in 'Income' | 'Expense']: string[] } = {
    Income: ['Salary', 'Freelance', 'Other'],
    Expense: ['Food', 'Travel', 'Shopping', 'Bills', 'Other']
  };

  API_URL = 'http://127.0.0.1:8000';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadExpenses();
  }

  // ---------------- LOAD ----------------
  loadExpenses() {
    this.http.get<any>(`${this.API_URL}/expenses/`).subscribe({
      next: (data) => {
        this.expenses = (Array.isArray(data.expenses) ? data.expenses : []).map((e: any): Expense => ({
          id: e.id,
          amount: e.amount,
          type: e.amount >= 0 ? 'Income' : 'Expense', // force correct type
          category: e.category,
          date: e.date
        }));
        this.filterByMonthAndType();
      },
      error: (err) => console.error('LOAD ERROR:', err)
    });
  }

  // ---------------- ADD/UPDATE ----------------
  addExpense() {
    if (!this.newExpense.amount || !this.newExpense.date) return;
    if (this.showCustomCategory && !this.customCategoryInput.trim()) return;

    const category = this.showCustomCategory ? this.customCategoryInput.trim() : this.newExpense.category;
    const amount = this.newExpense.type === 'Expense' ? -Math.abs(this.newExpense.amount) : Math.abs(this.newExpense.amount);

    const payload = {
      amount,
      category,
      date: this.newExpense.date
    };

    // ----- UPDATE -----
    if (this.editingExpenseId !== null) {
      const id = this.editingExpenseId;

      this.http.put(`${this.API_URL}/expenses/${id}/`, payload).subscribe({
        next: () => {
          const index = this.expenses.findIndex((e) => e.id === id);
          if (index !== -1) {
            this.expenses[index] = {
              id,
              amount: payload.amount,
              type: payload.amount >= 0 ? 'Income' : 'Expense',
              category: payload.category,
              date: payload.date
            };
          }
          this.filterByMonthAndType();
          this.resetForm();
        },
        error: (err) => console.error('UPDATE ERROR:', err)
      });

    // ----- ADD -----
    } else {
      this.http.post(`${this.API_URL}/expenses/add/`, { ...payload, type: this.newExpense.type }).subscribe({
        next: (res: any) => {
          const id = res.id || new Date().getTime();
          this.expenses.push({
            id,
            amount: payload.amount,
            type: payload.amount >= 0 ? 'Income' : 'Expense',
            category: payload.category,
            date: payload.date
          });
          this.filterByMonthAndType();
          this.resetForm();
        },
        error: (err) => console.error('ADD ERROR:', err)
      });
    }
  }

  // ---------------- RESET FORM ----------------
  resetForm() {
    this.newExpense = { amount: 0, type: 'Expense', category: '', date: '' };
    this.customCategoryInput = '';
    this.editingExpenseId = null;
    this.showCustomCategory = false;
    this.cdr.detectChanges();
  }

  // ---------------- EDIT ----------------
  startEdit(exp: Expense) {
    this.editingExpenseId = exp.id;

    const d = new Date(exp.date || '');
    const yyyy = d.getFullYear();
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    this.newExpense.date = `${yyyy}-${mm}-${dd}`;

    this.newExpense.amount = Math.abs(exp.amount);
    this.newExpense.type = exp.amount >= 0 ? 'Income' : 'Expense';

    if (this.categories[this.newExpense.type].includes(exp.category)) {
      this.newExpense.category = exp.category;
      this.showCustomCategory = false;
      this.customCategoryInput = '';
    } else {
      this.newExpense.category = 'Other';
      this.showCustomCategory = true;
      this.customCategoryInput = exp.category;
    }

    this.cdr.detectChanges();
  }

  // ---------------- DELETE ----------------
  deleteExpense(exp: Expense) {
    if (!confirm(`Are you sure you want to delete "${exp.category}"?`)) return;

    this.expenses = this.expenses.filter((e) => e.id !== exp.id);
    this.filteredExpenses = this.filteredExpenses.filter((e) => e.id !== exp.id);
    this.cdr.detectChanges();

    this.http.delete(`${this.API_URL}/expenses/${exp.id}/`).subscribe({
      next: () => {},
      error: (err) => {
        console.error('DELETE ERROR:', err);
        this.expenses.push(exp);
        this.filteredExpenses.push(exp);
        this.cdr.detectChanges();
      }
    });
  }

  // ---------------- FILTER ----------------
  filterByMonthAndType() {
    this.filteredExpenses = this.expenses.filter((e) => {
      const matchType = this.selectedType === 'All' || e.type === this.selectedType;
      if (!this.selectedMonth) return matchType;
      if (!e.date) return false;
      const [year, month] = this.selectedMonth.split('-').map(Number);
      const d = new Date(e.date);
      return matchType && d.getFullYear() === year && d.getMonth() + 1 === month;
    });

    this.filteredExpenses.sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
    this.cdr.detectChanges();
  }

  filterByMonth() { this.filterByMonthAndType(); }

  filterByType(type: 'All' | 'Income' | 'Expense') {
    this.selectedType = type;
    this.filterByMonthAndType();
  }

  // ---------------- TOTALS ----------------
  get totalIncome() {
    return this.filteredExpenses.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
  }

  get totalExpense() {
    return this.filteredExpenses.filter((e) => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0);
  }

  get balance() {
    return this.totalIncome - this.totalExpense;
  }

  // ---------------- NAV ----------------
  goToDashboard() { this.router.navigate(['/dashboard']); }
  goToTasks() { this.router.navigate(['/tasks']); }

  logout() { this.router.navigate(['']); }

  // ---------------- TYPE & CATEGORY HANDLERS ----------------
  onTypeChange(value: 'Income' | 'Expense') {
    this.newExpense.type = value;
    this.newExpense.category = '';
    this.showCustomCategory = false;
    this.customCategoryInput = '';
  }

  onCategoryChange(value: string) {
    if (value === 'Other') {
      this.showCustomCategory = true;
      this.customCategoryInput = '';
    } else {
      this.showCustomCategory = false;
      this.newExpense.category = value;
    }
  }
}