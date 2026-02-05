import React from 'react';
import { render, screen } from '@testing-library/react';
import LoginSignUp from '../Pages/LoginSignUp/LoginSignUp';

describe('LoginSignUp Component', () => {
  it('should render form inputs', () => {
    render(<LoginSignUp />);

    // Check heading
    expect(screen.getByRole('heading', { name: /sign up/i })).toBeInTheDocument();

    // Check input fields by placeholder
    expect(screen.getByPlaceholderText('Your Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email Address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();

    // Check Continue button
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();

    // Check checkbox
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
  });

  it('should display login link for existing users', () => {
    render(<LoginSignUp />);

    expect(screen.getByText('Already have an account?')).toBeInTheDocument();
    expect(screen.getByText('Login here')).toBeInTheDocument();
  });

  it('should display terms and conditions text', () => {
    render(<LoginSignUp />);

    expect(screen.getByText(/by continuing, i agree to the terms of use & privacy policy/i)).toBeInTheDocument();
  });
});
