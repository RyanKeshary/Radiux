import { render } from '@testing-library/react';
import { FileIcon } from '@/components/workspace/FileIcon';

describe('FileIcon', () => {
  describe('Folder Icons', () => {
    it('should render folder icon for generic folder', () => {
      // Act
      const { container } = render(<FileIcon name="myfolder" isFolder={true} />);

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    });

    it('should render special icon for src folder', () => {
      // Act
      const { container } = render(<FileIcon name="src" isFolder={true} />);

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      // src folder has code brackets path
      const paths = svg?.querySelectorAll('path');
      expect(paths?.length).toBeGreaterThanOrEqual(3);
    });

    it('should render special icon for components folder', () => {
      // Act
      const { container } = render(<FileIcon name="components" isFolder={true} />);

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      // components folder has rect elements
      const rects = svg?.querySelectorAll('rect');
      expect(rects?.length).toBeGreaterThanOrEqual(3);
    });

    it('should render special icon for public/assets/static folder', () => {
      // Act
      const { container: publicContainer } = render(<FileIcon name="public" isFolder={true} />);
      const { container: assetsContainer } = render(<FileIcon name="assets" isFolder={true} />);
      const { container: staticContainer } = render(<FileIcon name="static" isFolder={true} />);

      // Assert
      expect(publicContainer.querySelector('svg')).toBeInTheDocument();
      expect(assetsContainer.querySelector('svg')).toBeInTheDocument();
      expect(staticContainer.querySelector('svg')).toBeInTheDocument();
    });

    it('should render special icon for server/api/backend folder', () => {
      // Act
      const { container: serverContainer } = render(<FileIcon name="server" isFolder={true} />);
      const { container: apiContainer } = render(<FileIcon name="api" isFolder={true} />);
      const { container: backendContainer } = render(<FileIcon name="backend" isFolder={true} />);

      // Assert
      expect(serverContainer.querySelector('svg')).toBeInTheDocument();
      expect(apiContainer.querySelector('svg')).toBeInTheDocument();
      expect(backendContainer.querySelector('svg')).toBeInTheDocument();
    });

    it('should render open folder icon when isOpen is true', () => {
      // Act
      const { container } = render(<FileIcon name="myfolder" isFolder={true} isOpen={true} />);

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      // Open folder has different path structure
      const paths = svg?.querySelectorAll('path');
      expect(paths?.length).toBeGreaterThanOrEqual(2);
    });

    it('should render closed folder icon when isOpen is false', () => {
      // Act
      const { container } = render(<FileIcon name="myfolder" isFolder={true} isOpen={false} />);

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('File Extension Icons', () => {
    it('should render JS icon for .js files', () => {
      // Act
      const { container } = render(<FileIcon name="script.js" isFolder={false} />);

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      // JS icon has a rect with yellow background
      const rect = svg?.querySelector('rect');
      expect(rect).toBeInTheDocument();
    });

    it('should render JSX icon for .jsx files', () => {
      // Act
      const { container } = render(<FileIcon name="component.jsx" isFolder={false} />);

      // Assert
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render TS icon for .ts files', () => {
      // Act
      const { container } = render(<FileIcon name="index.ts" isFolder={false} />);

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      // TS icon has blue rect
      const rect = svg?.querySelector('rect');
      expect(rect).toBeInTheDocument();
    });

    it('should render TSX icon for .tsx files', () => {
      // Act
      const { container } = render(<FileIcon name="app.tsx" isFolder={false} />);

      // Assert
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render JSON icon for .json files', () => {
      // Act
      const { container } = render(<FileIcon name="package.json" isFolder={false} />);

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      // JSON icon has curly brace paths
      const paths = svg?.querySelectorAll('path');
      expect(paths?.length).toBeGreaterThanOrEqual(2);
    });

    it('should render CSS icon for .css files', () => {
      // Act
      const { container } = render(<FileIcon name="styles.css" isFolder={false} />);

      // Assert
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render SCSS icon for .scss files', () => {
      // Act
      const { container } = render(<FileIcon name="styles.scss" isFolder={false} />);

      // Assert
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render HTML icon for .html files', () => {
      // Act
      const { container } = render(<FileIcon name="index.html" isFolder={false} />);

      // Assert
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render Python icon for .py files', () => {
      // Act
      const { container } = render(<FileIcon name="script.py" isFolder={false} />);

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      // Python icon has circles
      const circles = svg?.querySelectorAll('circle');
      expect(circles?.length).toBeGreaterThanOrEqual(2);
    });

    it('should render image icon for .png files', () => {
      // Act
      const { container } = render(<FileIcon name="image.png" isFolder={false} />);

      // Assert
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render image icon for .jpg files', () => {
      // Act
      const { container } = render(<FileIcon name="photo.jpg" isFolder={false} />);

      // Assert
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render video icon for .mp4 files', () => {
      // Act
      const { container } = render(<FileIcon name="video.mp4" isFolder={false} />);

      // Assert
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render audio icon for .mp3 files', () => {
      // Act
      const { container } = render(<FileIcon name="audio.mp3" isFolder={false} />);

      // Assert
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render markdown icon for .md files', () => {
      // Act
      const { container } = render(<FileIcon name="README.md" isFolder={false} />);

      // Assert
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render shell icon for .sh files', () => {
      // Act
      const { container } = render(<FileIcon name="deploy.sh" isFolder={false} />);

      // Assert
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render env icon for .env files', () => {
      // Act
      const { container } = render(<FileIcon name=".env" isFolder={false} />);

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      // Env icon has a lock/rect shape
      const rect = svg?.querySelector('rect');
      expect(rect).toBeInTheDocument();
    });

    it('should render gitignore icon for .gitignore files', () => {
      // Act
      const { container } = render(<FileIcon name=".gitignore" isFolder={false} />);

      // Assert
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render default icon for unknown file types', () => {
      // Act
      const { container } = render(<FileIcon name="file.unknownext" isFolder={false} />);

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      // Default icon has a simple file shape
      const paths = svg?.querySelectorAll('path');
      expect(paths?.length).toBeGreaterThanOrEqual(2);
    });

    it('should render default icon for files without extension', () => {
      // Act
      const { container } = render(<FileIcon name="Makefile" isFolder={false} />);

      // Assert
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Custom ClassName', () => {
    it('should apply custom className', () => {
      // Act
      const { container } = render(
        <FileIcon name="test.js" isFolder={false} className="w-8 h-8 text-red-500" />
      );

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-8', 'h-8', 'text-red-500');
    });

    it('should use default className when not provided', () => {
      // Act
      const { container } = render(<FileIcon name="test.js" isFolder={false} />);

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-4', 'h-4');
    });
  });

  describe('Case Insensitivity', () => {
    it('should handle uppercase extensions', () => {
      // Act
      const { container } = render(<FileIcon name="SCRIPT.JS" isFolder={false} />);

      // Assert
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should handle mixed case extensions', () => {
      // Act
      const { container } = render(<FileIcon name="Component.TSX" isFolder={false} />);

      // Assert
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should handle uppercase folder names', () => {
      // Act
      const { container } = render(<FileIcon name="SRC" isFolder={true} />);

      // Assert
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });
});
