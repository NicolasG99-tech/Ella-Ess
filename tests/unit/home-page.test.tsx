import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';

describe('HomePage', () => {
  it('zeigt den Produktnamen an', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: /lese-abenteuer/i })).toBeInTheDocument();
  });
});
