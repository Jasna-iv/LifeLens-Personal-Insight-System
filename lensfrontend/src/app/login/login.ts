import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {

  username = '';
  password = '';
  rememberMe = false;
  showPassword = false;
  error = '';

  constructor(private router: Router, private http: HttpClient) {}

  togglePassword(event: Event) {
    event.preventDefault();
    this.showPassword = !this.showPassword;
  }

 onLogin() {
  this.http.post('http://127.0.0.1:8000/login/', {
    username: this.username,
    password: this.password
  }, { withCredentials: true })   // ✅ important for session
  .subscribe({
    next: (res: any) => {
      this.error = '';
      localStorage.setItem('isLoggedIn', 'true');
      this.router.navigate(['/dashboard']);  // ✅ success
    },
    error: (err) => {
      this.error = 'Invalid username or password';
    }
  });
}
}