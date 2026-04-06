import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpenseComponent } from './expenses';

describe('Expenses', () => {
  let component: ExpenseComponent;
  let fixture: ComponentFixture<ExpenseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpenseComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
