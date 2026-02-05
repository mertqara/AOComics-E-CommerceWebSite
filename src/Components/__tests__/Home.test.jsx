import React from 'react';
import { render, screen } from '@testing-library/react';
import Home from '../Pages/Home/Home';

describe('Home Component', () => {
  it('should render featured comics grid', () => {
    render(<Home />);

    // Check section heading
    expect(screen.getByRole('heading', { name: /just added/i })).toBeInTheDocument();

    // Check if all 3 comics are rendered
    expect(screen.getByText('1776 (2025) #1')).toBeInTheDocument();
    expect(screen.getByText('Captain America (2018)')).toBeInTheDocument();
    expect(screen.getByText('Spider-Man & Wolverine (2025) #6')).toBeInTheDocument();

    // Check if all comics have Marvel brand
    const marvelBrands = screen.getAllByText('Marvel');
    expect(marvelBrands).toHaveLength(3);

    // Check if Purchase buttons are rendered
    const purchaseButtons = screen.getAllByRole('button', { name: /purchase/i });
    expect(purchaseButtons).toHaveLength(3);
  });

  it('should render header component', () => {
    render(<Home />);

    // Header should contain "Comics" heading
    expect(screen.getByRole('heading', { name: /^comics$/i })).toBeInTheDocument();
  });
});
