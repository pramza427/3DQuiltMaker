import { useState, useCallback, useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { FolderOpen, Move, PaintBucket, Pencil, Printer, Redo, Save, Trash2, Undo, ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';

const QUILT_SIZES = {
  'Crib': { width: 30, height: 45 },
  'Twin': { width: 70, height: 90 },
  'Full': { width: 85, height: 95 },
  'Queen': { width: 90, height: 100 },
  'King': { width: 105, height: 105 }
};

const TRIANGLE_SIZES = Array.from({ length: 10 }, (_, i) => 2 + (i * 0.5));

const TriangleHeightToSideRatio = 1.155;
const PX_SCALE = 10;

const QuiltDesigner = () => {
  const [selectedSize, setSelectedSize] = useState('Twin');
  const [triangleHeight, setTriangleHeight] = useState(3);
  const [triangleSide, setTriangleSide] = useState(3 * TriangleHeightToSideRatio)
  const [selectedColor, setSelectedColor] = useState('#6366f1');
  const [triangleColors, setTriangleColors] = useState({});
  const [colorHistory, setColorHistory] = useState([{}]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [columns, setColumns] = useState(0);
  const [rows, setRows] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);
  const [tool, setTool] = useState('pencil'); // 'pencil' or 'bucket'
  const [showInstructions, setShowInstructions] = useState(true);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [designName, setDesignName] = useState('');
  const [savedDesigns, setSavedDesigns] = useState([]);

  useEffect(() => {
    const designs = JSON.parse(localStorage.getItem('quiltDesigns') || '[]');
    setSavedDesigns(designs);
  }, []);

  const handleSaveDesign = () => {
    if (!designName.trim()) return;

    const designToSave = {
      id: Date.now(),
      name: designName,
      data: {
        triangleColors,
        selectedSize,
        triangleHeight,
        columns,
        rows
      },
      date: new Date().toISOString()
    };

    const updatedDesigns = [...savedDesigns, designToSave];
    localStorage.setItem('quiltDesigns', JSON.stringify(updatedDesigns));
    setSavedDesigns(updatedDesigns);
    setDesignName('');
    setSaveDialogOpen(false);
  };

  const handleLoadDesign = (design) => {
    setTriangleColors(design.data.triangleColors);
    setSelectedSize(design.data.selectedSize);
    setTriangleHeight(design.data.triangleHeight);
    setColumns(design.data.columns);
    setRows(design.data.rows);
    setLoadDialogOpen(false);

    // Add to history
    setColorHistory(prev => [...prev, design.data.triangleColors]);
    setCurrentHistoryIndex(prev => prev + 1);
  };

  const handleDeleteDesign = (id) => {
    const updatedDesigns = savedDesigns.filter(design => design.id !== id);
    localStorage.setItem('quiltDesigns', JSON.stringify(updatedDesigns));
    setSavedDesigns(updatedDesigns);
  };

  function SaveLoadControls() {
    return (
      <div className="flex gap-2 justify-center">
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Save className="w-4 h-4 mr-2" />
              Save Design
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Design</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Design Name</Label>
                <Input
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  placeholder="My Quilt Design"
                />
              </div>
              <Button onClick={handleSaveDesign} disabled={!designName.trim()}>
                Save Design
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <FolderOpen className="w-4 h-4 mr-2" />
              Load Design
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Load Design</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 overflow-y-auto">
              {savedDesigns.length === 0 ? (
                <div className="text-center text-gray-500">No saved designs</div>
              ) : (
                savedDesigns.map(design => (
                  <div
                    key={design.id}
                    className="flex items-center justify-between p-4 border rounded hover:bg-gray-50"
                  >
                    <div>
                      <div className="font-medium">{design.name}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(design.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLoadDesign(design)}
                      >
                        Load
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteDesign(design.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Add flood fill function
  const floodFill = useCallback((startId) => {
    const [startRow, startCol, type] = startId.split('-').slice(1);
    const targetColor = triangleColors[startId] || (type === 'right' ? '#6366f1' : '#818cf8');
    const newColor = selectedColor;

    if (targetColor === newColor) return;

    const stack = [startId];
    const newColors = { ...triangleColors };

    while (stack.length) {
      const currentId = stack.pop();
      if (newColors[currentId] === newColor) continue;

      const [row, col, triangleType] = currentId.split('-').slice(1);
      newColors[currentId] = newColor;

      // Get neighboring triangles
      const neighbors = [];
      if (triangleType === 'right') {
        neighbors.push(
          `triangle-${row}-${col}-left`,
          `triangle-${parseInt(row) - 1}-${col}-left`,
          `triangle-${row}-${parseInt(col) + 1}-left`
        );
      } else {
        neighbors.push(
          `triangle-${row}-${col}-right`,
          `triangle-${parseInt(row) + 1}-${col}-right`,
          `triangle-${row}-${parseInt(col) - 1}-right`
        );
      }

      for (const neighbor of neighbors) {
        if (triangleColors[neighbor] === targetColor) {
          stack.push(neighbor);
        }
      }
    }

    setTriangleColors(newColors);
  }, [triangleColors, selectedColor]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5)); // Max zoom 5x
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.5)); // Min zoom 0.5x
  };

  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDownPan = useCallback((e) => {
    if (e.button === 1 || e.button === 2) { // Middle or right mouse button
      e.preventDefault();
      setIsPanning(true);
      setStartPan({
        x: e.clientX - pan.x,
        y: e.clientY - pan.y
      });
    }
  }, [pan]);

  const handleMouseMovePan = useCallback((e) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y
      });
    }
  }, [isPanning, startPan]);

  const handleMouseUpPan = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY * -0.01;
      setZoom(prev => Math.max(0.5, Math.min(5, prev * (1 + delta))));
    }
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (svg) {
      svg.addEventListener('wheel', handleWheel, { passive: false });
      return () => svg.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  useEffect(() => {
    setTriangleSide(triangleHeight * TriangleHeightToSideRatio)
  }, [triangleHeight]);

  useEffect(() => {
    getTriangleCounts();
  }, [triangleHeight, selectedSize]);

  const getTriangleCounts = () => {
    const size = QUILT_SIZES[selectedSize];
    setColumns(Math.ceil(size.width / triangleHeight))
    setRows(Math.ceil(size.height / triangleSide))
  };

  const getActualQuiltSize = () => {
    const actualWidth = columns * triangleHeight;
    const actualHeight = rows * triangleSide;
    return {
      width: actualWidth.toFixed(2),
      height: actualHeight.toFixed(2),
    };
  };

  const handleTriangleClick = useCallback((id) => {
    if (tool === 'bucket') {
      floodFill(id);
    } else {
      setTriangleColors(prev => ({
        ...prev,
        [id]: selectedColor
      }));
    }
  }, [tool, selectedColor, floodFill]);

  const handleUndo = () => {
    if (currentHistoryIndex > 0) {
      const newIndex = currentHistoryIndex - 1;
      setCurrentHistoryIndex(newIndex);
      setTriangleColors(colorHistory[newIndex]);
    }
  };

  const handleRedo = () => {
    if (currentHistoryIndex < colorHistory.length - 1) {
      const newIndex = currentHistoryIndex + 1;
      setCurrentHistoryIndex(newIndex);
      setTriangleColors(colorHistory[newIndex]);
    }
  };

  const handleMouseDown = useCallback((e) => {
    if (e.button === 0) { // Only set drawing true for left mouse button
      setIsDrawing(true);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
    // Add to history, removing any future states if we're in the middle of history
    setColorHistory(history => [
      ...history.slice(0, currentHistoryIndex + 1),
      triangleColors
    ]);
    setCurrentHistoryIndex(currentHistoryIndex + 1);
  }, [triangleColors]);

  const handleMouseOver = useCallback((id) => {
    if (isDrawing && !isPanning) { // Only draw if we're in drawing mode and not panning
      handleTriangleClick(id);
    }
  }, [isDrawing, isPanning, handleTriangleClick]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const svgElement = document.querySelector('#quilt-svg')?.cloneNode(true);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Quilt Pattern</title>
          <style>
            @media print {
              body { margin: 0; }
              svg { max-width: 100%; height: auto; }
            }
          </style>
        </head>
        <body>
          ${svgElement?.outerHTML}
        </body>
      </html>
    `;
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }

  };

  const renderTrianglePattern = () => {
    const triangles = [];
    const triangleWidthPx = triangleHeight * PX_SCALE;
    const triangleSidePx = triangleSide * PX_SCALE;

    // Add column labels
    for (let i = 0; i < columns; i++) {
      triangles.push(
        <text
          key={`column-${i}`}
          x={i * triangleWidthPx + (triangleWidthPx / 2)}
          y="-10"
          textAnchor="middle"
          fontSize="12"
          className="print-only select-none"
        >
          {i + 1}
        </text>
      );
    }

    // Add existing triangle pattern
    for (let col = 0; col < columns; col++) {
      for (let row = 0; row < rows; row++) {
        const xOffset = col * triangleWidthPx;
        const yOffset = 10 + row * triangleSidePx - (col % 2 === 0 ? (triangleSidePx / 2) : 0);

        const xOffset2 = col * triangleWidthPx;
        const yOffset2 = 10 + row * triangleSidePx - (triangleSidePx / 2) + (col % 2 === 0 ? (triangleSidePx / 2) : 0);

        const rightTriangleId = `triangle-${row}-${col}-right`;
        const leftTriangleId = `triangle-${row}-${col}-left`;

        triangles.push(
          <path
            key={rightTriangleId}
            id={rightTriangleId}
            d={`M ${xOffset} ${yOffset} L ${xOffset + triangleWidthPx} ${yOffset + (triangleSidePx / 2)} L ${xOffset} ${yOffset + triangleSidePx} Z`}
            fill={triangleColors[rightTriangleId] || '#6366f1'}
            stroke={triangleColors[rightTriangleId] || '#6366f1'}
            strokeWidth="1"
            onClick={() => handleTriangleClick(rightTriangleId)}
            onMouseOver={() => handleMouseOver(rightTriangleId)}
            style={{ cursor: 'pointer' }}
          />
        );

        triangles.push(
          <path
            key={leftTriangleId}
            id={leftTriangleId}
            d={`M ${xOffset2 + triangleWidthPx} ${yOffset2} L ${xOffset + triangleWidthPx} ${yOffset2 + triangleSidePx} L ${xOffset} ${yOffset2 + (triangleSidePx / 2)} Z`}
            fill={triangleColors[leftTriangleId] || '#818cf8'}
            stroke={triangleColors[leftTriangleId] || '#818cf8'}
            strokeWidth="1"
            onClick={() => handleTriangleClick(leftTriangleId)}
            onMouseOver={() => handleMouseOver(leftTriangleId)}
            style={{ cursor: 'pointer' }}
          />
        );
      }
    }

    return triangles;
  };

  function Controls() {
    return (
      <div className='z-50 absolute left-0 bottom-0 p-2 gap-2 flex flex-col items-center'>
        <input
          type="color"
          value={selectedColor}
          onChange={(e) => setSelectedColor(e.target.value)}
          className="w-16 h-16  cursor-pointer"
        />
        <Button
          onClick={() => setTool('pencil')}
          variant={tool === 'pencil' ? 'default' : 'outline'}
          className="rounded-full"
        >
          <Pencil />
        </Button>
        <Button
          onClick={() => setTool('bucket')}
          variant={tool === 'bucket' ? 'default' : 'outline'}
          className="rounded-full"
        >
          <PaintBucket />
        </Button>
        <Button
          onClick={handleUndo}
          disabled={currentHistoryIndex === 0}
          className="rounded-full"
        >
          <Undo />
        </Button>
        <Button
          onClick={handleRedo}
          disabled={currentHistoryIndex === colorHistory.length - 1}
          className="rounded-full"
        >
          <Redo />
        </Button>
        <Button onClick={handleZoomIn} className="rounded-full">
          <ZoomIn size={48} />
        </Button>
        <Button onClick={handleZoomOut} className="rounded-full">
          <ZoomOut />
        </Button>
        <Button onClick={handleZoomReset} className="rounded-full">
          <Move />
        </Button>
      </div>
    )
  }

  const actualSize = getActualQuiltSize();
  const svgWidth = parseFloat(actualSize.width) * PX_SCALE;
  const svgHeight = parseFloat(actualSize.height) * PX_SCALE;

  return (
    <div className="relative flex flex-col w-screen h-screen bg-white text-black">
      <Controls />
      <div className='w-full text-center space-y-4 mb-6'>
        <div className='text-3xl font-semibold'>3D Quilt Pattern Designer</div>
        <Button onClick={handlePrint} className="ml-4">
          <Printer className="w-4 h-4 mr-2" />
          Print Pattern
        </Button>
        <SaveLoadControls />
      </div>

      <div className="space-y-4 flex flex-col flex-grow">
        <div className="flex gap-4 flex-wrap items-center justify-center">
          <div className="w-64">
            <Label className="block text-sm font-medium mb-2">Quilt Size</Label>
            <Select
              value={selectedSize}
              onValueChange={setSelectedSize}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select quilt size" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(QUILT_SIZES).map(size => (
                  <SelectItem key={size} value={size}>
                    {size} ({QUILT_SIZES[size].width}" × {QUILT_SIZES[size].height}")
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-64">
            <Label className="block text-sm font-medium mb-2">Triangle Size (inches)</Label>
            <Select
              value={triangleHeight.toString()}
              onValueChange={(value) => setTriangleHeight(parseFloat(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select triangle size" />
              </SelectTrigger>
              <SelectContent>
                {TRIANGLE_SIZES.map(size => (
                  <SelectItem key={size} value={size.toString()}>
                    {size.toFixed(1)}"
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='w-full text-center text-sm text-gray-600'>
            <div className="space-x-2">
              <span>Actual quilt size:</span>
              <strong>{actualSize.width}" × {actualSize.height}"</strong>
              {actualSize.width !== QUILT_SIZES[selectedSize].width ||
                actualSize.height !== QUILT_SIZES[selectedSize].height ? (
                <span>(adjusted to fit triangle pattern)</span>
              ) : null}
            </div>
            <div className="space-x-2">
              ({columns} * {triangleHeight}") x ({rows} * {triangleHeight * TriangleHeightToSideRatio}")
            </div>
          </div>
        </div>

        <div
          className="flex flex-grow items-center justify-center bg-gray-100 border overflow-hidden"
          onContextMenu={(e) => e.preventDefault()}
          onMouseDown={(e) => {
            if (e.button === 1 || e.button === 2) { // Middle or right mouse button
              handleMouseDownPan(e);
            } else if (e.button === 0) { // Left mouse button
              handleMouseDown(e);
            }
          }}
          onMouseMove={(e) => {
            if (isPanning) {
              handleMouseMovePan(e);
            } else {
              handleMouseOver(e.target.id);
            }
          }}
          onMouseUp={(e) => {
            if (isPanning) {
              handleMouseUpPan();
            } else if (e.button === 0) { // Only handle mouse up for left button
              handleMouseUp();
            }
          }}
          onMouseLeave={(e) => {
            handleMouseUpPan();
            setIsDrawing(false);
          }}
        >
          <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Welcome to the Quilt Designer!</DialogTitle>
                <DialogDescription className="space-y-4">
                  <p>Here's how to use the tools:</p>
                  <ul className="list-disc pl-4 space-y-2">
                    <li><strong>Drawing:</strong> Click and drag with the pencil tool to color triangles</li>
                    <li><strong>Fill:</strong> Use the bucket tool to fill connected areas of the same color</li>
                    <li><strong>Navigation:</strong> Right-click or middle-click and drag to pan, use ctrl/cmd + scroll to zoom</li>
                    <li><strong>History:</strong> Use undo/redo buttons to step through your changes</li>
                    <li><strong>Color:</strong> Click the color wheel to choose your active color</li>
                    <li><strong>Size:</strong> Adjust quilt and triangle sizes using the dropdown menus</li>
                  </ul>
                  <p>Click anywhere or press Escape to start designing!</p>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
          <svg
            ref={svgRef}
            id="quilt-svg"
            viewBox={`0 -${triangleSide * PX_SCALE} ${svgWidth} ${svgHeight + triangleSide * PX_SCALE + 30}`}
            width={svgWidth}
            height={svgHeight}
            className="max-w-full max-h-full cursor-grab"
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transition: isPanning ? 'none' : 'transform 0.1s'
            }}
          >
            {renderTrianglePattern()}

          </svg>
        </div>

      </div>
    </div>
  );
};

export default QuiltDesigner;