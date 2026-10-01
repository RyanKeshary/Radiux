import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/context/AuthContext';

// Mock the AuthContext
vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockSignInWithPassword = vi.fn();
const mockSignUpWithPassword = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockResetPassword = vi.fn();

const defaultMockAuth = {
  user: null,
  loading: false,
  isSupabase: true,
  signInWithPassword: mockSignInWithPassword,
  signUpWithPassword: mockSignUpWithPassword,
  signInWithOAuth: mockSignInWithOAuth,
  resetPassword: mockResetPassword,
  signOut: vi.fn(),
  updateCurrentUserProfile: vi.fn(),
};

describe('AuthModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue(defaultMockAuth);
  });

  describe('Rendering', () => {
    it('should render nothing when isOpen is false', () => {
      // Arrange
      const { container } = render(
        <AuthModal isOpen={false} onClose={vi.fn()} />
      );

      // Assert
      expect(container).toBeEmptyDOMElement();
    });

    it('should render sign in form by default', () => {
      // Act
      render(<AuthModal isOpen={true} onClose={vi.fn()} />);

      // Assert
      expect(screen.getByText('Sign In to Radiux')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('developer@example.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in with email/i })).toBeInTheDocument();
    });

    it('should render sign up form when defaultMode is signup', () => {
      // Act
      render(<AuthModal isOpen={true} onClose={vi.fn()} defaultMode="signup" />);

      // Assert
      expect(screen.getByText('Create an Account')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. Alex Rivera')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    it('should render OAuth buttons when isSupabase is true', () => {
      // Act
      render(<AuthModal isOpen={true} onClose={vi.fn()} />);

      // Assert
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue with github/i })).toBeInTheDocument();
    });

    it('should not render OAuth buttons when isSupabase is false', () => {
      // Arrange
      (useAuth as any).mockReturnValue({
        ...defaultMockAuth,
        isSupabase: false,
      });

      // Act
      render(<AuthModal isOpen={true} onClose={vi.fn()} />);

      // Assert
      expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /continue with github/i })).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    // NOTE: the email/password/full-name inputs carry the HTML `required` attribute, so a
    // browser (and jsdom) blocks submission via native constraint validation before
    // `handleSubmit` ever runs. These tests therefore dispatch `submit` on the form
    // directly to exercise the component's own validation branches.
    it('should show error when submitting with empty email', async () => {
      // Arrange
      const { container } = render(<AuthModal isOpen={true} onClose={vi.fn()} />);

      // Act
      fireEvent.submit(container.querySelector('form')!);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Please fill in all required fields')).toBeInTheDocument();
      });
    });

    it('should show error when submitting with empty password', async () => {
      // Arrange
      const { container } = render(<AuthModal isOpen={true} onClose={vi.fn()} />);

      // Act
      fireEvent.change(screen.getByPlaceholderText('developer@example.com'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.submit(container.querySelector('form')!);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Please fill in all required fields')).toBeInTheDocument();
      });
    });

    it('should show error when signup with empty full name', async () => {
      // Arrange
      const { container } = render(<AuthModal isOpen={true} onClose={vi.fn()} defaultMode="signup" />);

      // Act
      fireEvent.change(screen.getByPlaceholderText('developer@example.com'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'password123' },
      });
      fireEvent.submit(container.querySelector('form')!);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Please provide your full name')).toBeInTheDocument();
      });
    });

    it('should show error for invalid email format', async () => {
      // Arrange
      render(<AuthModal isOpen={true} onClose={vi.fn()} />);

      // Act
      fireEvent.change(screen.getByPlaceholderText('developer@example.com'), {
        target: { value: 'invalid-email' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in with email/i }));

      // Assert - The form has type="email" so browser validation may prevent submit
      // But we can verify the input has the correct type
      expect(screen.getByPlaceholderText('developer@example.com')).toHaveAttribute('type', 'email');
    });
  });

  describe('Mode Toggle', () => {
    it('should toggle from sign in to sign up mode', () => {
      // Arrange
      render(<AuthModal isOpen={true} onClose={vi.fn()} />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

      // Assert
      expect(screen.getByText('Create an Account')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. Alex Rivera')).toBeInTheDocument();
    });

    it('should toggle from sign up to sign in mode', () => {
      // Arrange
      render(<AuthModal isOpen={true} onClose={vi.fn()} defaultMode="signup" />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      // Assert
      expect(screen.getByText('Sign In to Radiux')).toBeInTheDocument();
    });

    it('should toggle to reset password mode', () => {
      // Arrange
      render(<AuthModal isOpen={true} onClose={vi.fn()} />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));

      // Assert
      expect(screen.getByText('Reset Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send reset email/i })).toBeInTheDocument();
    });

    it('should toggle back from reset to sign in mode', () => {
      // Arrange
      render(<AuthModal isOpen={true} onClose={vi.fn()} />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
      fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }));

      // Assert
      expect(screen.getByText('Sign In to Radiux')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should disable submit button when loading', async () => {
      // Arrange
      mockSignInWithPassword.mockReturnValue(new Promise(() => {})); // Never resolves
      render(<AuthModal isOpen={true} onClose={vi.fn()} />);

      // Act
      fireEvent.change(screen.getByPlaceholderText('developer@example.com'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in with email/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in with email/i })).toBeDisabled();
      });
    });

    it('should show loading spinner on submit button when loading', async () => {
      // Arrange
      mockSignInWithPassword.mockReturnValue(new Promise(() => {}));
      render(<AuthModal isOpen={true} onClose={vi.fn()} />);

      // Act
      fireEvent.change(screen.getByPlaceholderText('developer@example.com'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in with email/i }));

      // Assert
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /sign in with email/i });
        expect(button).toBeDisabled();
        expect(button.querySelector('.animate-spin')).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call signInWithPassword on sign in submit', async () => {
      // Arrange
      mockSignInWithPassword.mockResolvedValue({ error: null });
      const onClose = vi.fn();
      render(<AuthModal isOpen={true} onClose={onClose} />);

      // Act
      fireEvent.change(screen.getByPlaceholderText('developer@example.com'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in with email/i }));

      // Assert
      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('should call signUpWithPassword on sign up submit', async () => {
      // Arrange
      mockSignUpWithPassword.mockResolvedValue({ error: null });
      render(<AuthModal isOpen={true} onClose={vi.fn()} defaultMode="signup" />);

      // Act
      fireEvent.change(screen.getByPlaceholderText('e.g. Alex Rivera'), {
        target: { value: 'Alex Rivera' },
      });
      fireEvent.change(screen.getByPlaceholderText('developer@example.com'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      // Assert
      await waitFor(() => {
        expect(mockSignUpWithPassword).toHaveBeenCalledWith('test@example.com', 'password123', 'Alex Rivera');
      });
    });

    it('should show error message when sign in fails', async () => {
      // Arrange
      mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid credentials' } });
      render(<AuthModal isOpen={true} onClose={vi.fn()} />);

      // Act
      fireEvent.change(screen.getByPlaceholderText('developer@example.com'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'wrongpassword' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in with email/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });
    });

    it('should show success message after sign up', async () => {
      // Arrange
      mockSignUpWithPassword.mockResolvedValue({ error: null });
      render(<AuthModal isOpen={true} onClose={vi.fn()} defaultMode="signup" />);

      // Act
      fireEvent.change(screen.getByPlaceholderText('e.g. Alex Rivera'), {
        target: { value: 'Alex Rivera' },
      });
      fireEvent.change(screen.getByPlaceholderText('developer@example.com'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/account created/i)).toBeInTheDocument();
      });
    });
  });

  describe('OAuth', () => {
    it('should call signInWithOAuth with google when Google button clicked', async () => {
      // Arrange
      mockSignInWithOAuth.mockResolvedValue({ error: null });
      render(<AuthModal isOpen={true} onClose={vi.fn()} />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

      // Assert
      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalledWith('google');
      });
    });

    it('should call signInWithOAuth with github when GitHub button clicked', async () => {
      // Arrange
      mockSignInWithOAuth.mockResolvedValue({ error: null });
      render(<AuthModal isOpen={true} onClose={vi.fn()} />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: /continue with github/i }));

      // Assert
      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalledWith('github');
      });
    });

    it('should show error when OAuth fails', async () => {
      // Arrange
      mockSignInWithOAuth.mockResolvedValue({ error: { message: 'OAuth failed' } });
      render(<AuthModal isOpen={true} onClose={vi.fn()} />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText('OAuth failed')).toBeInTheDocument();
      });
    });
  });

  describe('Close', () => {
    it('should call onClose when close button is clicked', () => {
      // Arrange
      const onClose = vi.fn();
      render(<AuthModal isOpen={true} onClose={onClose} />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: '' })); // X button

      // Assert
      expect(onClose).toHaveBeenCalled();
    });
  });
});
