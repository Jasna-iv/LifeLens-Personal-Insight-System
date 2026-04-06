import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TasksComponent } from './tasks/tasks';  // correct path
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  protected readonly title = signal('lifelens-frontend');
}
export class LoginComponent {

  username = '';
  password = '';

  constructor(private router: Router) {}

  login() {
    // TEMP login check (frontend only)
    if (this.username && this.password) {
      this.router.navigate(['/dashboard']);   // ✅ go to dashboard
    } else {
      alert('Enter username & password');
    }
  }
}
