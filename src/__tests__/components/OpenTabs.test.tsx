import { render, screen, fireEvent } from '@testing-library/react';
import { OpenTabs } from '@/components/workspace/OpenTabs';
import { FileItem } from '@/lib/types';

const mockFiles: FileItem[] = [
  {
    id: 'file-1',
    project_id: 'proj-1',
    parent_id: null,
    name: 'index.ts',
    is_folder: false,
    content: 'console.log("hello")',
    language: 'typescript',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 'file-2',
    project_id: 'proj-1',
    parent_id: null,
    name: 'app.tsx',
    is_folder: false,
    content: 'export default function App() {}',
    language: 'typescript',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 'file-3',
    project_id: 'proj-1',
    parent_id: null,
    name: 'styles.css',
    is_folder: false,
    content: 'body {}',
    language: 'css',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
];

const defaultProps = {
  openFiles: mockFiles,
  activeFileId: 'file-1',
  onSelectTab: vi.fn(),
  onCloseTab: vi.fn(),
};

describe('OpenTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render nothing when no files are open', () => {
      // Act
      const { container } = render(<OpenTabs {...defaultProps} openFiles={[]} />);

      // Assert
      expect(container).toBeEmptyDOMElement();
    });

    it('should render all open file tabs', () => {
      // Act
      render(<OpenTabs {...defaultProps} />);

      // Assert
      expect(screen.getByText('index.ts')).toBeInTheDocument();
      expect(screen.getByText('app.tsx')).toBeInTheDocument();
      expect(screen.getByText('styles.css')).toBeInTheDocument();
    });

    it('should render file icons for each tab', () => {
      // Act
      const { container } = render(<OpenTabs {...defaultProps} />);

      // Assert
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThanOrEqual(3);
    });

    it('should highlight the active tab', () => {
      // Act
      render(<OpenTabs {...defaultProps} activeFileId="file-2" />);

      // Assert
      const activeTab = screen.getByText('app.tsx').closest('div');
      expect(activeTab).toHaveClass('font-semibold');
    });
  });

  describe('Tab Switching', () => {
    it('should call onSelectTab when a tab is clicked', () => {
      // Arrange
      const onSelectTab = vi.fn();

      // Act
      render(<OpenTabs {...defaultProps} onSelectTab={onSelectTab} />);

      // Act
      fireEvent.click(screen.getByText('app.tsx'));

      // Assert
      expect(onSelectTab).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'file-2', name: 'app.tsx' })
      );
    });

    it('should call onSelectTab with correct file for each tab', () => {
      // Arrange
      const onSelectTab = vi.fn();

      // Act
      render(<OpenTabs {...defaultProps} onSelectTab={onSelectTab} />);

      // Act
      fireEvent.click(screen.getByText('styles.css'));

      // Assert
      expect(onSelectTab).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'file-3', name: 'styles.css' })
      );
    });
  });

  describe('Tab Close', () => {
    it('should call onCloseTab when close button is clicked', () => {
      // Arrange
      const onCloseTab = vi.fn();

      // Act
      render(<OpenTabs {...defaultProps} onCloseTab={onCloseTab} />);

      // Act - One close button exists per open tab, so target the first explicitly.
      fireEvent.click(screen.getAllByTitle('Close (Ctrl+W)')[0]);

      // Assert
      expect(onCloseTab).toHaveBeenCalledWith('file-1');
    });

    it('should call onCloseTab with correct file id for each tab', () => {
      // Arrange
      const onCloseTab = vi.fn();

      // Act
      render(<OpenTabs {...defaultProps} onCloseTab={onCloseTab} />);

      // Act - Click the second tab's close button
      const closeButtons = screen.getAllByTitle('Close (Ctrl+W)');
      fireEvent.click(closeButtons[1]);

      // Assert
      expect(onCloseTab).toHaveBeenCalledWith('file-2');
    });
  });

  describe('Dirty Indicator', () => {
    it('should show dirty indicator for modified files', () => {
      // Arrange
      const dirtyFileIds = new Set(['file-1']);

      // Act
      render(<OpenTabs {...defaultProps} dirtyFileIds={dirtyFileIds} />);

      // Assert
      const dirtyIndicator = document.querySelector('.fill-current');
      expect(dirtyIndicator).toBeInTheDocument();
    });

    it('should not show dirty indicator for clean files', () => {
      // Act
      render(<OpenTabs {...defaultProps} dirtyFileIds={new Set()} />);

      // Assert
      const dirtyIndicator = document.querySelector('.fill-current');
      expect(dirtyIndicator).not.toBeInTheDocument();
    });

    it('should show dirty indicator with correct styling', () => {
      // Arrange
      const dirtyFileIds = new Set(['file-2']);

      // Act
      render(<OpenTabs {...defaultProps} dirtyFileIds={dirtyFileIds} />);

      // Assert
      const dirtyIndicator = document.querySelector('.text-sky-400');
      expect(dirtyIndicator).toBeInTheDocument();
    });
  });

  describe('Context Menu', () => {
    it('should open context menu on right-click on a tab', () => {
      // Act
      render(<OpenTabs {...defaultProps} />);

      // Act
      fireEvent.contextMenu(screen.getByText('index.ts'));

      // Assert
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('should show Close Others option in context menu', () => {
      // Arrange
      const onCloseOthers = vi.fn();

      // Act
      render(<OpenTabs {...defaultProps} onCloseOthers={onCloseOthers} />);

      // Act
      fireEvent.contextMenu(screen.getByText('index.ts'));

      // Assert
      expect(screen.getByText('Close Others')).toBeInTheDocument();
    });

    it('should show Close All option in context menu', () => {
      // Arrange
      const onCloseAll = vi.fn();

      // Act
      render(<OpenTabs {...defaultProps} onCloseAll={onCloseAll} />);

      // Act
      fireEvent.contextMenu(screen.getByText('index.ts'));

      // Assert
      expect(screen.getByText('Close All')).toBeInTheDocument();
    });

    it('should call onCloseOthers when Close Others is clicked', () => {
      // Arrange
      const onCloseOthers = vi.fn();

      // Act
      render(<OpenTabs {...defaultProps} onCloseOthers={onCloseOthers} />);

      // Act
      fireEvent.contextMenu(screen.getByText('index.ts'));
      fireEvent.click(screen.getByText('Close Others'));

      // Assert
      expect(onCloseOthers).toHaveBeenCalledWith('file-1');
    });

    it('should call onCloseAll when Close All is clicked', () => {
      // Arrange
      const onCloseAll = vi.fn();

      // Act
      render(<OpenTabs {...defaultProps} onCloseAll={onCloseAll} />);

      // Act
      fireEvent.contextMenu(screen.getByText('index.ts'));
      fireEvent.click(screen.getByText('Close All'));

      // Assert
      expect(onCloseAll).toHaveBeenCalled();
    });
  });

  describe('Split Editor', () => {
    it('should render split right button when onSplitRight is provided', () => {
      // Act
      render(<OpenTabs {...defaultProps} onSplitRight={vi.fn()} />);

      // Assert
      expect(screen.getByTitle('Split Editor Right (Ctrl+\\)')).toBeInTheDocument();
    });

    it('should render split down button when onSplitDown is provided', () => {
      // Act
      render(<OpenTabs {...defaultProps} onSplitDown={vi.fn()} />);

      // Assert
      expect(screen.getByTitle('Split Editor Down')).toBeInTheDocument();
    });

    it('should call onSplitRight when split right button is clicked', () => {
      // Arrange
      const onSplitRight = vi.fn();

      // Act
      render(<OpenTabs {...defaultProps} onSplitRight={onSplitRight} />);

      // Act
      fireEvent.click(screen.getByTitle('Split Editor Right (Ctrl+\\)'));

      // Assert
      expect(onSplitRight).toHaveBeenCalled();
    });

    it('should call onSplitDown when split down button is clicked', () => {
      // Arrange
      const onSplitDown = vi.fn();

      // Act
      render(<OpenTabs {...defaultProps} onSplitDown={onSplitDown} />);

      // Act
      fireEvent.click(screen.getByTitle('Split Editor Down'));

      // Assert
      expect(onSplitDown).toHaveBeenCalled();
    });
  });

  describe('Collaborator Presence', () => {
    it('should render collaborator dots on tabs', () => {
      // Arrange
      const collaboratorsByFile = {
        'file-1': [
          { id: 'user-1', name: 'Alice', color: '#ff0000' },
        ],
      };

      // Act
      render(<OpenTabs {...defaultProps} collaboratorsByFile={collaboratorsByFile} />);

      // Assert
      const peerDots = document.querySelectorAll('[title^="Collaborators on this file"]');
      expect(peerDots.length).toBe(1);
    });
  });
});
