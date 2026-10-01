import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileTree } from '@/components/workspace/FileTree';
import { FileItem } from '@/lib/types';

// Mock the ContextMenu.
// Mirrors the real component's behaviour: each item renders a clickable control that
// invokes `item.onClick`. (Rendering a non-interactive <div> here meant menu clicks
// silently did nothing.)
vi.mock('@/components/workspace/ContextMenu', () => ({
  ContextMenu: ({ isOpen, items }: any) => (
    <div data-testid="context-menu">
      {isOpen &&
        items?.map((item: any) => (
          <button
            key={item.id}
            type="button"
            data-testid={`menu-item-${item.id}`}
            onClick={() => item.onClick?.()}
          >
            {item.label}
          </button>
        ))}
    </div>
  ),
}));

const mockFiles: FileItem[] = [
  {
    id: 'folder-src',
    project_id: 'proj-1',
    parent_id: null,
    name: 'src',
    is_folder: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 'file-1',
    project_id: 'proj-1',
    parent_id: 'folder-src',
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
    parent_id: 'folder-src',
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
    name: 'package.json',
    is_folder: false,
    content: '{}',
    language: 'json',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
];

const defaultProps = {
  files: mockFiles,
  activeFileId: null,
  onSelectFile: vi.fn(),
  onCreateFile: vi.fn().mockResolvedValue(undefined),
  onRenameFile: vi.fn().mockResolvedValue(undefined),
  onDeleteFile: vi.fn().mockResolvedValue(undefined),
};

describe('FileTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render file explorer header', () => {
      // Act
      render(<FileTree {...defaultProps} />);

      // Assert
      expect(screen.getByText('Files Explorer')).toBeInTheDocument();
    });

    it('should render root level files and folders', () => {
      // Act
      render(<FileTree {...defaultProps} />);

      // Assert
      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('package.json')).toBeInTheDocument();
    });

    it('should render children of open folders', () => {
      // Act
      render(<FileTree {...defaultProps} />);

      // Assert - src folder is open by default
      expect(screen.getByText('index.ts')).toBeInTheDocument();
      expect(screen.getByText('app.tsx')).toBeInTheDocument();
    });

    it('should render empty state when no files', () => {
      // Act
      render(<FileTree {...defaultProps} files={[]} />);

      // Assert
      expect(screen.getByText(/no files in project/i)).toBeInTheDocument();
    });

    it('should render folder icons for folders', () => {
      // Act
      const { container } = render(<FileTree {...defaultProps} />);

      // Assert
      const folderElements = container.querySelectorAll('svg');
      expect(folderElements.length).toBeGreaterThan(0);
    });
  });

  describe('Folder Expand/Collapse', () => {
    it('should toggle folder open state on click', () => {
      // Act
      render(<FileTree {...defaultProps} />);

      // Act - Click on src folder to close it
      fireEvent.click(screen.getByText('src'));

      // Assert - Children should be hidden
      expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
      expect(screen.queryByText('app.tsx')).not.toBeInTheDocument();
    });

    it('should show children when folder is expanded', () => {
      // Act
      render(<FileTree {...defaultProps} />);

      // Act - Click to close
      fireEvent.click(screen.getByText('src'));
      expect(screen.queryByText('index.ts')).not.toBeInTheDocument();

      // Act - Click to open again
      fireEvent.click(screen.getByText('src'));

      // Assert
      expect(screen.getByText('index.ts')).toBeInTheDocument();
      expect(screen.getByText('app.tsx')).toBeInTheDocument();
    });
  });

  describe('File Selection', () => {
    it('should call onSelectFile when a file is clicked', () => {
      // Arrange
      const onSelectFile = vi.fn();

      // Act
      render(<FileTree {...defaultProps} onSelectFile={onSelectFile} />);

      // Act
      fireEvent.click(screen.getByText('index.ts'));

      // Assert
      expect(onSelectFile).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'file-1', name: 'index.ts' })
      );
    });

    it('should highlight the active file', () => {
      // Act
      render(<FileTree {...defaultProps} activeFileId="file-1" />);

      // Assert
      // The file name renders inside a span nested in the clickable row. Anchor on the
      // row's stable `group` class rather than the nearest <div>, which is the outer
      // node wrapper and carries no active-state classes.
      const activeRow = screen.getByText('index.ts').closest('.group');
      expect(activeRow).toHaveClass('font-medium');
      expect(activeRow).toHaveClass('border-l-2');
    });
  });

  describe('Context Menu', () => {
    it('should open context menu on right-click on a file', () => {
      // Act
      render(<FileTree {...defaultProps} />);

      // Act
      fireEvent.contextMenu(screen.getByText('index.ts'));

      // Assert
      expect(screen.getByTestId('context-menu')).toBeInTheDocument();
    });

    it('should show file-specific menu items for files', () => {
      // Act
      render(<FileTree {...defaultProps} />);

      // Act
      fireEvent.contextMenu(screen.getByText('index.ts'));

      // Assert
      expect(screen.getByTestId('menu-item-open')).toBeInTheDocument();
      expect(screen.getByTestId('menu-item-rename')).toBeInTheDocument();
      expect(screen.getByTestId('menu-item-delete')).toBeInTheDocument();
    });

    it('should show folder-specific menu items for folders', () => {
      // Act
      render(<FileTree {...defaultProps} />);

      // Act
      fireEvent.contextMenu(screen.getByText('src'));

      // Assert
      expect(screen.getByTestId('menu-item-new-file')).toBeInTheDocument();
      expect(screen.getByTestId('menu-item-new-folder')).toBeInTheDocument();
      expect(screen.getByTestId('menu-item-rename')).toBeInTheDocument();
    });

    it('should show root context menu on right-click on empty area', () => {
      // Act
      render(<FileTree {...defaultProps} />);

      // Act
      fireEvent.contextMenu(screen.getByText('Files Explorer'));

      // Assert
      expect(screen.getByTestId('menu-item-new-file')).toBeInTheDocument();
      expect(screen.getByTestId('menu-item-new-folder')).toBeInTheDocument();
    });
  });

  describe('File Operations', () => {
    it('should call onDeleteFile when delete is confirmed', async () => {
      // Arrange
      const onDeleteFile = vi.fn().mockResolvedValue(undefined);
      global.confirm = vi.fn(() => true);
      vi.stubGlobal('confirm', vi.fn(() => true));

      // Act
      render(<FileTree {...defaultProps} onDeleteFile={onDeleteFile} />);

      // Act - Right click and click delete
      fireEvent.contextMenu(screen.getByText('index.ts'));
      fireEvent.click(screen.getByTestId('menu-item-delete'));

      // Assert
      await waitFor(() => {
        expect(onDeleteFile).toHaveBeenCalledWith('file-1');
      });
    });

    it('should not call onDeleteFile when delete is cancelled', () => {
      // Arrange
      const onDeleteFile = vi.fn();
      global.confirm = vi.fn(() => false);
      vi.stubGlobal('confirm', vi.fn(() => false));

      // Act
      render(<FileTree {...defaultProps} onDeleteFile={onDeleteFile} />);

      // Act
      fireEvent.contextMenu(screen.getByText('index.ts'));
      fireEvent.click(screen.getByTestId('menu-item-delete'));

      // Assert
      expect(onDeleteFile).not.toHaveBeenCalled();
    });

    it('should start rename mode when rename is clicked', () => {
      // Act
      render(<FileTree {...defaultProps} />);

      // Act
      fireEvent.contextMenu(screen.getByText('index.ts'));
      fireEvent.click(screen.getByTestId('menu-item-rename'));

      // Assert
      expect(screen.getByDisplayValue('index.ts')).toBeInTheDocument();
    });
  });

  describe('Collaborator Presence', () => {
    it('should render collaborator dots when collaborators are present', () => {
      // Arrange
      const collaboratorsByFile = {
        'file-1': [
          { id: 'user-1', name: 'Alice', color: '#ff0000' },
          { id: 'user-2', name: 'Bob', color: '#00ff00' },
        ],
      };

      // Act
      render(<FileTree {...defaultProps} collaboratorsByFile={collaboratorsByFile} />);

      // Assert
      const dots = document.querySelectorAll('[title^="Editing:"]');
      expect(dots.length).toBe(1);
    });
  });
});
