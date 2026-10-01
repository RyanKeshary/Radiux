import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserMenu } from '@/components/auth/UserMenu';
import { useAuth } from '@/context/AuthContext';

// Mock the AuthContext
vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock the hooks and child components
vi.mock('@/hooks/useClickOutside', () => ({
  useClickOutside: vi.fn(),
}));

vi.mock('@/components/workspace/EditorSettingsModal', () => ({
  EditorSettingsModal: () => <div data-testid="editor-settings-modal" />,
}));

vi.mock('@/components/workspace/UserProfileModal', () => ({
  UserProfileModal: () => <div data-testid="user-profile-modal" />,
}));

vi.mock('@/components/workspace/PublicProfileModal', () => ({
  PublicProfileModal: () => <div data-testid="public-profile-modal" />,
}));

vi.mock('@/components/workspace/KeyboardShortcutsModal', () => ({
  KeyboardShortcutsModal: () => <div data-testid="keyboard-shortcuts-modal" />,
}));

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  full_name: 'Test User',
  username: 'testuser',
  avatar_url: null,
  role: 'user',
};

const defaultMockAuth = {
  user: mockUser,
  loading: false,
  isSupabase: true,
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  resetPassword: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  updateCurrentUserProfile: vi.fn(),
};

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue(defaultMockAuth);
  });

  describe('Loading State', () => {
    it('should render loading indicator when loading is true', () => {
      // Arrange
      (useAuth as any).mockReturnValue({
        ...defaultMockAuth,
        loading: true,
      });

      // Act
      render(<UserMenu />);

      // Assert
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Unauthenticated State', () => {
    it('should render Sign In and Sign Up buttons when user is null', () => {
      // Arrange
      (useAuth as any).mockReturnValue({
        ...defaultMockAuth,
        user: null,
      });

      // Act
      render(<UserMenu />);

      // Assert
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    });

    it('should not render user menu when user is null', () => {
      // Arrange
      (useAuth as any).mockReturnValue({
        ...defaultMockAuth,
        user: null,
      });

      // Act
      render(<UserMenu />);

      // Assert
      expect(screen.queryByText('Test User')).not.toBeInTheDocument();
    });
  });

  describe('Authenticated State - User Info', () => {
    it('should render user full name when available', () => {
      // Act
      render(<UserMenu />);

      // Assert
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('should render user email when full_name is not available', () => {
      // Arrange
      (useAuth as any).mockReturnValue({
        ...defaultMockAuth,
        user: { ...mockUser, full_name: '' },
      });

      // Act
      render(<UserMenu />);

      // Assert
      expect(screen.getByText('test')).toBeInTheDocument(); // email.split('@')[0]
    });

    it('should render user avatar initial', () => {
      // Act
      render(<UserMenu />);

      // Assert
      expect(screen.getByText('T')).toBeInTheDocument(); // First letter of "Test User"
    });
  });

  describe('Dropdown', () => {
    it('should open dropdown when user button is clicked', () => {
      // Act
      render(<UserMenu />);

      // Act
      fireEvent.click(screen.getByTitle('Test User'));

      // Assert
      expect(screen.getByText('Public Profile')).toBeInTheDocument();
      expect(screen.getByText('Coding Partners')).toBeInTheDocument();
      expect(screen.getByText('Discover Developers')).toBeInTheDocument();
      expect(screen.getByText('Profile & Account')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Shortcuts')).toBeInTheDocument();
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });

    it('should close dropdown when clicked again', () => {
      // Act
      render(<UserMenu />);

      // Act - Open
      fireEvent.click(screen.getByTitle('Test User'));
      expect(screen.getByText('Public Profile')).toBeInTheDocument();

      // Act - Close
      fireEvent.click(screen.getByTitle('Test User'));

      // Assert
      expect(screen.queryByText('Public Profile')).not.toBeInTheDocument();
    });

    it('should show user email in dropdown header', () => {
      // Act
      render(<UserMenu />);

      // Act
      fireEvent.click(screen.getByTitle('Test User'));

      // Assert
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  describe('Menu Items', () => {
    it('should call onOpenProfileModal when Profile & Account is clicked', () => {
      // Arrange
      const onOpenProfileModal = vi.fn();
      render(<UserMenu onOpenProfileModal={onOpenProfileModal} />);

      // Act
      fireEvent.click(screen.getByTitle('Test User'));
      fireEvent.click(screen.getByText('Profile & Account'));

      // Assert
      expect(onOpenProfileModal).toHaveBeenCalledWith('profile');
    });

    it('should call onOpenSettingsModal when Settings is clicked', () => {
      // Arrange
      const onOpenSettingsModal = vi.fn();
      render(<UserMenu onOpenSettingsModal={onOpenSettingsModal} />);

      // Act
      fireEvent.click(screen.getByTitle('Test User'));
      fireEvent.click(screen.getByText('Settings'));

      // Assert
      expect(onOpenSettingsModal).toHaveBeenCalled();
    });

    it('should call onOpenShortcutsModal when Shortcuts is clicked', () => {
      // Arrange
      const onOpenShortcutsModal = vi.fn();
      render(<UserMenu onOpenShortcutsModal={onOpenShortcutsModal} />);

      // Act
      fireEvent.click(screen.getByTitle('Test User'));
      fireEvent.click(screen.getByText('Shortcuts'));

      // Assert
      expect(onOpenShortcutsModal).toHaveBeenCalled();
    });

    it('should call signOut when Sign Out is clicked', () => {
      // Act
      render(<UserMenu />);

      // Act
      fireEvent.click(screen.getByTitle('Test User'));
      fireEvent.click(screen.getByText('Sign Out'));

      // Assert
      expect(defaultMockAuth.signOut).toHaveBeenCalled();
    });

    it('should call onOpenPartnersModal when Coding Partners is clicked', () => {
      // Arrange
      const onOpenPartnersModal = vi.fn();
      render(<UserMenu onOpenPartnersModal={onOpenPartnersModal} />);

      // Act
      fireEvent.click(screen.getByTitle('Test User'));
      fireEvent.click(screen.getByText('Coding Partners'));

      // Assert
      expect(onOpenPartnersModal).toHaveBeenCalled();
    });

    it('should call onViewPublicProfile when Public Profile is clicked', () => {
      // Arrange
      const onViewPublicProfile = vi.fn();
      render(<UserMenu onViewPublicProfile={onViewPublicProfile} />);

      // Act
      fireEvent.click(screen.getByTitle('Test User'));
      fireEvent.click(screen.getByText('Public Profile'));

      // Assert
      expect(onViewPublicProfile).toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts Display', () => {
    it('should show Ctrl+, shortcut for Settings', () => {
      // Act
      render(<UserMenu />);

      // Act
      fireEvent.click(screen.getByTitle('Test User'));

      // Assert
      expect(screen.getByText('Ctrl+,')).toBeInTheDocument();
    });

    it('should show Ctrl+K shortcut for Shortcuts', () => {
      // Act
      render(<UserMenu />);

      // Act
      fireEvent.click(screen.getByTitle('Test User'));

      // Assert
      expect(screen.getByText('Ctrl+K')).toBeInTheDocument();
    });
  });
});
