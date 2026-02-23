import { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, PresentationControls } from '@react-three/drei';
import { motion } from 'framer-motion';
import { 
  Palette, 
  Undo2, 
  Redo2, 
  Save, 
  Share2, 
  ShoppingCart,
  Upload,
  Type,
  Image as ImageIcon,
  Sparkles,
  RotateCcw,
  Download
} from 'lucide-react';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { useStore } from '@/store/useStore';
import { useFeatureConfig } from '@/lib/featureConfig';
import { tattooElements, patternElements } from '@/lib/mockData';
import { productsAPI, apiProductToProduct } from '@/lib/api';
import type { Product } from '@/lib/types';
import { toast } from 'sonner';

// 3D Shirt Component
function Shirt3D({ colors }: { colors: { body: string; collar: string; sleeves: string } }) {
  return (
    <group>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2, 2.5, 0.5]} />
        <meshStandardMaterial color={colors.body} />
      </mesh>
      
      {/* Collar */}
      <mesh position={[0, 1.4, 0.1]}>
        <boxGeometry args={[0.8, 0.3, 0.3]} />
        <meshStandardMaterial color={colors.collar} />
      </mesh>
      
      {/* Left Sleeve */}
      <mesh position={[-1.3, 0.5, 0]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.8, 1.5, 0.4]} />
        <meshStandardMaterial color={colors.sleeves} />
      </mesh>
      
      {/* Right Sleeve */}
      <mesh position={[1.3, 0.5, 0]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.8, 1.5, 0.4]} />
        <meshStandardMaterial color={colors.sleeves} />
      </mesh>
    </group>
  );
}

const colorPresets = [
  { name: 'Lavender Dream', body: '#8B5CF6', collar: '#7C3AED', sleeves: '#A78BFA' },
  { name: 'Ocean Blue', body: '#3B82F6', collar: '#1D4ED8', sleeves: '#60A5FA' },
  { name: 'Sunset Orange', body: '#F97316', collar: '#EA580C', sleeves: '#FB923C' },
  { name: 'Forest Green', body: '#22C55E', collar: '#16A34A', sleeves: '#4ADE80' },
  { name: 'Rose Pink', body: '#EC4899', collar: '#DB2777', sleeves: '#F472B6' },
  { name: 'Classic Black', body: '#1F2937', collar: '#111827', sleeves: '#374151' },
  { name: 'Pure White', body: '#F9FAFB', collar: '#E5E7EB', sleeves: '#FFFFFF' },
  { name: 'Royal Purple', body: '#7C3AED', collar: '#6D28D9', sleeves: '#8B5CF6' },
];

export default function Customize() {
  const [colors, setColors] = useState({
    body: '#8B5CF6',
    collar: '#7C3AED',
    sleeves: '#A78BFA',
  });
  const [selectedPart, setSelectedPart] = useState<'body' | 'collar' | 'sleeves'>('body');
  const [addedElements, setAddedElements] = useState<any[]>([]);
  const [baseProduct, setBaseProduct] = useState<Product | null>(null);
  const { saveDesign, addToCart } = useStore();
  const { comingSoonEnabled } = useFeatureConfig();

  useEffect(() => {
    productsAPI
      .getList()
      .then((res) => {
        const list = (res.data ?? []).map(apiProductToProduct);
        const customizable = list.find((p) => p.isCustomizable) ?? list[0];
        setBaseProduct(customizable ?? null);
      })
      .catch(() => setBaseProduct(null));
  }, []);

  const handleColorChange = (color: string) => {
    setColors((prev) => ({ ...prev, [selectedPart]: color }));
  };

  const handlePresetSelect = (preset: typeof colorPresets[0]) => {
    setColors({
      body: preset.body,
      collar: preset.collar,
      sleeves: preset.sleeves,
    });
    toast.success(`Applied "${preset.name}" preset`);
  };

  const handleSaveDesign = () => {
    saveDesign({
      id: Date.now().toString(),
      name: 'Custom Design',
      baseColor: colors.body,
      collarColor: colors.collar,
      sleeveColor: colors.sleeves,
      bodyColor: colors.body,
      elements: addedElements,
      createdAt: new Date(),
    });
    toast.success('Design saved successfully!');
  };

  const handleAddToCart = () => {
    const product = baseProduct ?? {
      id: 'custom-shirt',
      name: 'Custom Designed Shirt',
      description: '',
      price: 0,
      category: 'shirts',
      image: '',
      inStock: true,
      rating: 0,
      reviews: 0,
    };
    const customProduct = {
      ...product,
      id: `custom-${Date.now()}`,
      name: 'Custom Designed Shirt',
      isCustomizable: false,
    };
    addToCart({
      product: customProduct,
      quantity: 1,
      size: 'M',
      customization: {
        id: Date.now().toString(),
        name: 'Custom Design',
        baseColor: colors.body,
        collarColor: colors.collar,
        sleeveColor: colors.sleeves,
        bodyColor: colors.body,
        elements: addedElements,
        createdAt: new Date(),
      },
    });
    toast.success('Custom design added to cart! You will receive a price quote via email.');
  };

  return (
    <div className="min-h-screen py-6 md:py-8 relative">
      {/* Coming Soon overlay: blur + disabled interactions when flag is on */}
      {comingSoonEnabled && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md"
          aria-live="polite"
        >
          <div className="text-center px-6 max-w-md">
            <h2 className="text-2xl md:text-3xl font-serif font-bold mb-2">Coming Soon</h2>
            <p className="text-muted-foreground">
              Our 3D Shirt Customizer is in the works. You’ll soon be able to design your own shirts with colors, elements, and text. Stay tuned.
            </p>
          </div>
        </div>
      )}
      <div className={`container mx-auto px-4 ${comingSoonEnabled ? 'pointer-events-none select-none' : ''}`}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 md:mb-8"
        >
          <h1 className="text-2xl md:text-4xl font-serif font-bold mb-2 flex items-center gap-2 md:gap-3">
            <Palette className="h-8 w-8 md:h-10 md:w-10 text-primary" />
            3D Shirt Customizer
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Design your unique shirt. Rotate 360°, customize colors, and add elements.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
          {/* 3D Viewer */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <div className="bg-card rounded-2xl border border-border overflow-hidden aspect-square md:aspect-[4/3]">
              <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
                <Suspense fallback={null}>
                  <ambientLight intensity={0.5} />
                  <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
                  <pointLight position={[-10, -10, -10]} />
                  
                  <PresentationControls
                    global
                    config={{ mass: 2, tension: 500 }}
                    snap={{ mass: 4, tension: 1500 }}
                    rotation={[0, 0.3, 0]}
                    polar={[-Math.PI / 3, Math.PI / 3]}
                    azimuth={[-Math.PI / 1.4, Math.PI / 2]}
                  >
                    <Shirt3D colors={colors} />
                  </PresentationControls>
                  
                  <Environment preset="city" />
                </Suspense>
              </Canvas>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap justify-center gap-2 md:gap-4 mt-4 md:mt-6">
              <Button variant="outline" size="sm" className="text-xs md:text-sm">
                <Undo2 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                Undo
              </Button>
              <Button variant="outline" size="sm" className="text-xs md:text-sm">
                <Redo2 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                Redo
              </Button>
              <Button variant="outline" size="sm" className="text-xs md:text-sm">
                <RotateCcw className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                Reset
              </Button>
              <Button variant="outline" size="sm" className="text-xs md:text-sm">
                <Download className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Controls Panel */}
          <div className="space-y-4 md:space-y-6 order-1 lg:order-2">
            <Tabs defaultValue="colors" className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="colors" className="text-xs md:text-sm">Colors</TabsTrigger>
                <TabsTrigger value="elements" className="text-xs md:text-sm">Elements</TabsTrigger>
                <TabsTrigger value="text" className="text-xs md:text-sm">Text</TabsTrigger>
              </TabsList>

              <TabsContent value="colors" className="space-y-4 md:space-y-6 mt-4 md:mt-6">
                {/* Part Selection */}
                <div className="space-y-2 md:space-y-3">
                  <label className="text-sm md:text-base font-medium">Select Part to Color</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['body', 'collar', 'sleeves'] as const).map((part) => (
                      <button
                        key={part}
                        onClick={() => setSelectedPart(part)}
                        className={`px-2 md:px-4 py-2 rounded-lg border capitalize transition-all text-xs md:text-sm ${
                          selectedPart === part
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {part}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Picker */}
                <div className="space-y-2 md:space-y-3">
                  <label className="text-sm md:text-base font-medium">Choose Color</label>
                  <div className="flex gap-2 md:gap-3">
                    <Input
                      type="color"
                      value={colors[selectedPart]}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="w-12 md:w-16 h-10 md:h-12 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={colors[selectedPart]}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="flex-1 text-sm"
                    />
                  </div>
                </div>

                {/* Color Presets */}
                <div className="space-y-2 md:space-y-3">
                  <label className="text-sm md:text-base font-medium">Color Presets</label>
                  <div className="grid grid-cols-4 gap-2">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => handlePresetSelect(preset)}
                        className="group relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary transition-all"
                        title={preset.name}
                      >
                        <div className="absolute inset-0" style={{ backgroundColor: preset.body }} />
                        <div className="absolute bottom-0 left-0 right-0 h-1/3" style={{ backgroundColor: preset.sleeves }} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Suggestions */}
                <div className="p-3 md:p-4 bg-accent/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-accent-foreground" />
                    <span className="text-sm md:text-base font-medium text-accent-foreground">AI Suggestion</span>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground mb-3">
                    Based on current trends, try "Royal Purple" for a bold statement!
                  </p>
                  <Button size="sm" variant="secondary" onClick={() => handlePresetSelect(colorPresets[7])} className="text-xs md:text-sm">
                    Apply Suggestion
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="elements" className="space-y-4 md:space-y-6 mt-4 md:mt-6">
                {/* Tattoos */}
                <div className="space-y-2 md:space-y-3">
                  <label className="text-sm md:text-base font-medium">Tattoos & Graphics</label>
                  <div className="grid grid-cols-4 gap-2">
                    {tattooElements.map((element) => (
                      <button
                        key={element.id}
                        className="aspect-square rounded-lg border border-border hover:border-primary transition-all p-2 flex items-center justify-center"
                        onClick={() => toast.info(`${element.name} - Drag and drop coming soon!`)}
                      >
                        <ImageIcon className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Patterns */}
                <div className="space-y-2 md:space-y-3">
                  <label className="text-sm md:text-base font-medium">Patterns</label>
                  <div className="grid grid-cols-4 gap-2">
                    {patternElements.map((element) => (
                      <button
                        key={element.id}
                        className="aspect-square rounded-lg border border-border hover:border-primary transition-all p-2 flex items-center justify-center"
                        onClick={() => toast.info(`${element.name} - Drag and drop coming soon!`)}
                      >
                        <div className="text-[10px] md:text-xs text-muted-foreground text-center">{element.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Upload */}
                <div className="space-y-2 md:space-y-3">
                  <label className="text-sm md:text-base font-medium">Upload Your Own</label>
                  <label className="flex flex-col items-center justify-center w-full h-24 md:h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                    <Upload className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground mb-2" />
                    <span className="text-xs md:text-sm text-muted-foreground">Click to upload</span>
                    <input type="file" className="hidden" accept="image/*" />
                  </label>
                </div>
              </TabsContent>

              <TabsContent value="text" className="space-y-4 md:space-y-6 mt-4 md:mt-6">
                <div className="space-y-2 md:space-y-3">
                  <label className="text-sm md:text-base font-medium">Add Text</label>
                  <Input placeholder="Enter your text..." className="text-sm" />
                </div>

                <div className="space-y-2 md:space-y-3">
                  <label className="text-sm md:text-base font-medium">Font Size</label>
                  <Slider defaultValue={[24]} max={72} min={12} step={2} />
                </div>

                <div className="space-y-2 md:space-y-3">
                  <label className="text-sm md:text-base font-medium">Text Color</label>
                  <Input type="color" defaultValue="#000000" className="w-full h-10 md:h-12" />
                </div>

                <Button className="w-full text-sm">
                  <Type className="h-4 w-4 mr-2" />
                  Add Text
                </Button>
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4 md:pt-6 border-t border-border">
              <Button className="w-full" size="lg" onClick={handleAddToCart}>
                <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                Add to Cart
              </Button>
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <Button variant="outline" onClick={handleSaveDesign} className="text-xs md:text-sm">
                  <Save className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  Save Design
                </Button>
                <Button variant="outline" className="text-xs md:text-sm">
                  <Share2 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  Share
                </Button>
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground text-center">
                * Custom designs are priced individually. You'll receive a quote via email.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}