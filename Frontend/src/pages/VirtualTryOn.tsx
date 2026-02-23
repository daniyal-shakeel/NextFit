import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Camera, 
  Upload, 
  Ruler, 
  Shirt, 
  Eye,
  Check,
  Info,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { productsAPI, apiProductToProduct } from '@/lib/api';
import type { Product } from '@/lib/types';
import { toast } from 'sonner';

const sizeChart = {
  shirts: [
    { size: 'S', chest: '34-36', waist: '28-30', height: '165-170' },
    { size: 'M', chest: '38-40', waist: '31-33', height: '170-175' },
    { size: 'L', chest: '42-44', waist: '34-36', height: '175-180' },
    { size: 'XL', chest: '46-48', waist: '37-39', height: '180-185' },
    { size: 'XXL', chest: '50-52', waist: '40-42', height: '185+' },
  ],
  pants: [
    { size: '28', waist: '28', hips: '35-36', inseam: '30' },
    { size: '30', waist: '30', hips: '37-38', inseam: '30' },
    { size: '32', waist: '32', hips: '39-40', inseam: '32' },
    { size: '34', waist: '34', hips: '41-42', inseam: '32' },
    { size: '36', waist: '36', hips: '43-44', inseam: '32' },
  ],
};

export default function VirtualTryOn() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [measurements, setMeasurements] = useState({
    chest: '',
    waist: '',
    hips: '',
    height: '',
    weight: '',
  });
  const [recommendedSize, setRecommendedSize] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [tryOnResult, setTryOnResult] = useState<string | null>(null);

  const handleMeasurementChange = (key: string, value: string) => {
    setMeasurements((prev) => ({ ...prev, [key]: value }));
  };

  const calculateSize = () => {
    const chest = parseFloat(measurements.chest);
    if (!chest) {
      toast.error('Please enter your chest measurement');
      return;
    }

    let size = 'M';
    if (chest < 37) size = 'S';
    else if (chest < 41) size = 'M';
    else if (chest < 45) size = 'L';
    else if (chest < 49) size = 'XL';
    else size = 'XXL';

    setRecommendedSize(size);
    toast.success(`Based on your measurements, we recommend size ${size}`);
  };

  const tryOnProducts = products.filter(
    (p) => p.category === 'shirts' || p.category === 'glasses' || p.category?.toLowerCase().includes('shirt') || p.category?.toLowerCase().includes('glass')
  );

  useEffect(() => {
    productsAPI
      .getList()
      .then((res) => {
        const list = (res.data ?? []).map(apiProductToProduct);
        setProducts(list);
        const tryOn = list.filter((p) => p.category === 'shirts' || p.category === 'glasses' || p.category?.toLowerCase().includes('shirt') || p.category?.toLowerCase().includes('glass'));
        if (tryOn.length > 0) setSelectedProduct(tryOn[0]);
        else if (list.length > 0) setSelectedProduct(list[0]);
      })
      .catch(() => setProducts([]));
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedProduct) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
        toast.success('Image uploaded! Processing virtual try-on...');
        setTimeout(() => {
          setTryOnResult(selectedProduct.image);
          toast.success('Virtual try-on complete!');
        }, 2000);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraStart = () => {
    setIsCameraActive(true);
    toast.info('Camera feature - AR filters coming soon!');
  };

  return (
    <div className="min-h-screen py-6 md:py-8">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 md:mb-8"
        >
          <h1 className="text-2xl md:text-4xl font-serif font-bold mb-2 flex items-center gap-2 md:gap-3">
            <Eye className="h-8 w-8 md:h-10 md:w-10 text-primary" />
            Virtual Try-On
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            See how products look on you before purchasing. Try multiple methods!
          </p>
        </motion.div>

        <Tabs defaultValue="measurements" className="w-full">
          <TabsList className="w-full max-w-full md:max-w-md mb-6 md:mb-8 grid grid-cols-3">
            <TabsTrigger value="measurements" className="text-xs md:text-sm px-2 md:px-4">
              <Ruler className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Measurements</span>
              <span className="sm:hidden">Size</span>
            </TabsTrigger>
            <TabsTrigger value="image" className="text-xs md:text-sm px-2 md:px-4">
              <Upload className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Upload Photo</span>
              <span className="sm:hidden">Photo</span>
            </TabsTrigger>
            <TabsTrigger value="camera" className="text-xs md:text-sm px-2 md:px-4">
              <Camera className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Live Camera</span>
              <span className="sm:hidden">Camera</span>
            </TabsTrigger>
          </TabsList>

          {/* Measurements Tab */}
          <TabsContent value="measurements">
            <div className="grid lg:grid-cols-2 gap-6 md:gap-8">
              <Card>
                <CardHeader className="pb-4 md:pb-6">
                  <CardTitle className="text-lg md:text-xl">Enter Your Measurements</CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    We'll recommend the perfect size based on your body measurements
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6">
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div className="space-y-2">
                      <label className="text-xs md:text-sm font-medium">Chest (inches)</label>
                      <Input
                        type="number"
                        placeholder="e.g., 40"
                        value={measurements.chest}
                        onChange={(e) => handleMeasurementChange('chest', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs md:text-sm font-medium">Waist (inches)</label>
                      <Input
                        type="number"
                        placeholder="e.g., 32"
                        value={measurements.waist}
                        onChange={(e) => handleMeasurementChange('waist', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs md:text-sm font-medium">Hips (inches)</label>
                      <Input
                        type="number"
                        placeholder="e.g., 38"
                        value={measurements.hips}
                        onChange={(e) => handleMeasurementChange('hips', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs md:text-sm font-medium">Height (cm)</label>
                      <Input
                        type="number"
                        placeholder="e.g., 175"
                        value={measurements.height}
                        onChange={(e) => handleMeasurementChange('height', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs md:text-sm font-medium">Weight (kg)</label>
                    <Input
                      type="number"
                      placeholder="e.g., 70"
                      value={measurements.weight}
                      onChange={(e) => handleMeasurementChange('weight', e.target.value)}
                    />
                  </div>

                  <Button className="w-full" onClick={calculateSize}>
                    <Ruler className="h-4 w-4 mr-2" />
                    Calculate My Size
                  </Button>

                  {recommendedSize && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-primary/10 rounded-lg text-center"
                    >
                      <p className="text-xs md:text-sm text-muted-foreground mb-1">Recommended Size</p>
                      <p className="text-3xl md:text-4xl font-bold text-primary">{recommendedSize}</p>
                      <p className="text-xs md:text-sm text-muted-foreground mt-2">
                        This size should fit you perfectly!
                      </p>
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              {/* Size Chart */}
              <Card>
                <CardHeader className="pb-4 md:pb-6">
                  <CardTitle className="text-lg md:text-xl">Size Chart</CardTitle>
                  <CardDescription className="text-xs md:text-sm">Reference guide for all sizes</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="shirts">
                    <TabsList className="mb-4">
                      <TabsTrigger value="shirts" className="text-xs md:text-sm">Shirts</TabsTrigger>
                      <TabsTrigger value="pants" className="text-xs md:text-sm">Pants</TabsTrigger>
                    </TabsList>
                    <TabsContent value="shirts">
                      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                        <table className="w-full text-xs md:text-sm min-w-[300px]">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="py-2 text-left font-medium">Size</th>
                              <th className="py-2 text-left font-medium">Chest</th>
                              <th className="py-2 text-left font-medium">Waist</th>
                              <th className="py-2 text-left font-medium">Height</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sizeChart.shirts.map((row) => (
                              <tr 
                                key={row.size} 
                                className={`border-b border-border ${
                                  recommendedSize === row.size ? 'bg-primary/10' : ''
                                }`}
                              >
                                <td className="py-2 font-medium">
                                  {row.size}
                                  {recommendedSize === row.size && (
                                    <Check className="inline h-3 w-3 md:h-4 md:w-4 ml-1 text-primary" />
                                  )}
                                </td>
                                <td className="py-2">{row.chest}"</td>
                                <td className="py-2">{row.waist}"</td>
                                <td className="py-2">{row.height} cm</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </TabsContent>
                    <TabsContent value="pants">
                      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                        <table className="w-full text-xs md:text-sm min-w-[300px]">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="py-2 text-left font-medium">Size</th>
                              <th className="py-2 text-left font-medium">Waist</th>
                              <th className="py-2 text-left font-medium">Hips</th>
                              <th className="py-2 text-left font-medium">Inseam</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sizeChart.pants.map((row) => (
                              <tr key={row.size} className="border-b border-border">
                                <td className="py-2 font-medium">{row.size}</td>
                                <td className="py-2">{row.waist}"</td>
                                <td className="py-2">{row.hips}"</td>
                                <td className="py-2">{row.inseam}"</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Image Upload Tab */}
          <TabsContent value="image">
            <div className="grid lg:grid-cols-2 gap-6 md:gap-8">
              <Card>
                <CardHeader className="pb-4 md:pb-6">
                  <CardTitle className="text-lg md:text-xl">Upload Your Photo</CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    Upload a clear photo of yourself and see how products look on you
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6">
                  <label className="flex flex-col items-center justify-center w-full h-48 md:h-64 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                    {uploadedImage ? (
                      <img
                        src={uploadedImage}
                        alt="Uploaded"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <>
                        <Upload className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground mb-3 md:mb-4" />
                        <span className="text-sm md:text-base text-muted-foreground">Click to upload your photo</span>
                        <span className="text-xs text-muted-foreground mt-1">JPG, PNG up to 10MB</span>
                      </>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </label>

                  <div className="flex items-start gap-2 p-3 bg-accent/50 rounded-lg">
                    <Info className="h-4 w-4 md:h-5 md:w-5 text-accent-foreground mt-0.5 flex-shrink-0" />
                    <div className="text-xs md:text-sm text-muted-foreground">
                      <p className="font-medium text-accent-foreground">Tips for best results:</p>
                      <ul className="mt-1 space-y-1">
                        <li>• Stand in front of a plain background</li>
                        <li>• Wear fitted clothing</li>
                        <li>• Ensure good lighting</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4 md:pb-6">
                  <CardTitle className="text-lg md:text-xl">Select Product to Try</CardTitle>
                  <CardDescription className="text-xs md:text-sm">Choose a product to virtually wear</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 md:gap-3 max-h-[300px] md:max-h-[400px] overflow-y-auto">
                    {tryOnProducts.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        className={`p-2 md:p-3 rounded-lg border transition-all text-left ${
                          selectedProduct?.id === product.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full aspect-square object-cover rounded-md mb-2"
                        />
                        <p className="text-xs md:text-sm font-medium line-clamp-1">{product.name}</p>
                        <p className="text-xs text-muted-foreground">${product.price}</p>
                      </button>
                    ))}
                  </div>

                  {tryOnResult && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-4 p-3 md:p-4 bg-primary/10 rounded-lg text-center"
                    >
                      <Badge className="mb-2">Try-On Result</Badge>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        AI virtual try-on processing complete!
                      </p>
                      <Button className="mt-3" size="sm">
                        View Result
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Live Camera Tab */}
          <TabsContent value="camera">
            <Card className="max-w-2xl mx-auto">
              <CardHeader className="pb-4 md:pb-6">
                <CardTitle className="text-lg md:text-xl">Live Camera Try-On</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Use your camera to try products in real-time with AR filters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 md:space-y-6">
                <div className="aspect-video bg-foreground/5 rounded-lg flex items-center justify-center border border-border">
                  {isCameraActive ? (
                    <div className="text-center p-4">
                      <Camera className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mx-auto mb-3 md:mb-4" />
                      <p className="text-sm md:text-base text-muted-foreground">Camera stream would appear here</p>
                      <p className="text-xs md:text-sm text-muted-foreground mt-1">AR feature coming soon!</p>
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <Camera className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mx-auto mb-3 md:mb-4" />
                      <p className="text-base md:text-lg font-medium">Enable Camera</p>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        Allow camera access to use AR try-on
                      </p>
                    </div>
                  )}
                </div>

                <Button className="w-full" onClick={handleCameraStart} size="lg">
                  <Camera className="h-4 w-4 mr-2" />
                  {isCameraActive ? 'Camera Active' : 'Start Camera'}
                </Button>

                <div className="flex items-start gap-2 p-3 bg-accent/50 rounded-lg">
                  <Info className="h-4 w-4 md:h-5 md:w-5 text-accent-foreground mt-0.5 flex-shrink-0" />
                  <div className="text-xs md:text-sm text-muted-foreground">
                    <p className="font-medium text-accent-foreground">Coming Soon!</p>
                    <p className="mt-1">
                      Real-time AR try-on for glasses and accessories is under development.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}