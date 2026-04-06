import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {

  const router = inject(Router);

  const isLoggedIn = localStorage.getItem('isLoggedIn');

  if (isLoggedIn == 'true') {
    return true;
  } else {
    router.navigate(['']);
    return false;
  }
};