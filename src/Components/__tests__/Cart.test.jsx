import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Cart from '../Pages/Cart/Cart';

describe('Cart Component', () => {
  it('should show empty cart message when cart is empty', () => {
    render(<Cart items={[]} />);

    expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
  });

  it('should render cart items with prices', () => {
    const mockItems = [
      {
        id: 1,
        title: 'Spider-Man Comic',
        description: 'Amazing Spider-Man',
        price: 15.99,
        qty: 2,
        img: 'comic1.png'
      },
      {
        id: 2,
        title: 'Batman Comic',
        description: 'Dark Knight',
        price: 12.99,
        qty: 1,
        img: 'comic2.png'
      }
    ];

    render(<Cart items={mockItems} />);

    // Check if items are rendered
    expect(screen.getByText('Spider-Man Comic')).toBeInTheDocument();
    expect(screen.getByText('Batman Comic')).toBeInTheDocument();

    // Check quantities
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    // Check prices
    expect(screen.getByText('$15.99')).toBeInTheDocument();
    expect(screen.getByText('$12.99')).toBeInTheDocument();
  });

  it('should call quantity increase handler when + button is clicked', () => {
    const mockOnQtyIncrease = jest.fn();
    const mockItems = [
      {
        id: 1,
        title: 'Spider-Man Comic',
        description: 'Amazing Spider-Man',
        price: 15.99,
        qty: 1,
        img: 'comic1.png'
      }
    ];

    render(<Cart items={mockItems} onQtyIncrease={mockOnQtyIncrease} />);

    const increaseButtons = screen.getAllByText('+');
    fireEvent.click(increaseButtons[0]);

    expect(mockOnQtyIncrease).toHaveBeenCalledWith(1);
  });

  it('should call remove handler when Remove button is clicked', () => {
    const mockOnRemove = jest.fn();
    const mockItems = [
      {
        id: 1,
        title: 'Spider-Man Comic',
        description: 'Amazing Spider-Man',
        price: 15.99,
        qty: 1,
        img: 'comic1.png'
      }
    ];

    render(<Cart items={mockItems} onRemove={mockOnRemove} />);

    const removeButton = screen.getByText('Remove');
    fireEvent.click(removeButton);

    expect(mockOnRemove).toHaveBeenCalledWith(1);
  });
});
