import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Heart,
  Share2,
  ShoppingCart,
  Star,
  Truck,
  Shield,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Check,
  Camera,
  Upload,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { productsAPI, apiProductToProduct } from '@/lib/api';
import { frontendProductsListKey } from '@/lib/queryClient';
import type { Product } from '@/lib/types';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';
import { ProductCard } from '@/components/product/ProductCard';
import { CURRENCY } from '@/lib/constants';

function isShirtCategory(category: string): boolean {
  const c = category.trim().toLowerCase();
  if (c === 'shirts' || c === 'shirt') return true;
  if (c.includes('shorts')) return false;
  return c.includes('shirt') || c.includes('t-shirt');
}

export default function ProductDetail() {
  const { id } = useParams();
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number } | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const { addToCart } = useStore();
  const navigate = useNavigate();

  const handleGalleryMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = galleryRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      setZoomOrigin({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
    },
    []
  );
  const handleGalleryMouseLeave = useCallback(() => setZoomOrigin(null), []);

  const productQuery = useQuery({
    queryKey: ['frontend', 'products', 'detail', id ?? ''],
    queryFn: async () => {
      const res = await productsAPI.getById(id!);
      return apiProductToProduct(res.data);
    },
    enabled: Boolean(id),
  });

  const listForRelatedQuery = useQuery({
    queryKey: frontendProductsListKey('all'),
    queryFn: () =>
      productsAPI.getList({}).then((res) => (res.data ?? []).map(apiProductToProduct)),
  });

  const product = productQuery.data ?? null;
  const relatedProducts = useMemo(() => {
    if (!product || !id) return [];
    const all = listForRelatedQuery.data ?? [];
    return all.filter((x) => x.category === product.category && x.id !== id).slice(0, 4);
  }, [product, listForRelatedQuery.data, id]);

  const loading = productQuery.isPending;
  const error =
    productQuery.error instanceof Error
      ? productQuery.error.message
      : productQuery.error
        ? String(productQuery.error)
        : null;

  useEffect(() => {
    if (!product) return;
    setSelectedSize(product.sizes?.[0] ?? '');
    setSelectedColor(product.colors?.[0] ?? '');
    setCurrentImageIndex(0);
  }, [product]);

  const mainImage = product?.image ?? '';
  const otherImages = (product?.images ?? []).filter((u) => u && u !== mainImage);
  const allImages = mainImage ? (otherImages.length > 0 ? [mainImage, ...otherImages] : [mainImage]) : [];
  const currentSrc = allImages[currentImageIndex] ?? mainImage;

  if (loading) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          <Skeleton className="h-6 w-48 mb-8" />
          <div className="grid lg:grid-cols-2 gap-12">
            <Skeleton className="aspect-square rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-foreground">{error ?? 'Product not found'}</h1>
          <Link to="/shop">
            <Button>Back to Shop</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleAddToCart = async () => {
    if (!product?.id) {
      toast.error('Invalid product');
      return;
    }
    const qty = Math.max(1, Math.min(999, quantity));
    try {
      await addToCart({
        product,
        quantity: qty,
        size: selectedSize || undefined,
        color: selectedColor || undefined,
      });
      toast.success(`${product.name} added to cart!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add to cart');
    }
  };


  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-primary">Shop</Link>
          <span>/</span>
          <Link to={`/shop?category=${product.category}`} className="hover:text-primary capitalize">
            {product.category}
          </Link>
          <span>/</span>
          <span className="text-foreground">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-3 sm:space-y-4"
          >
            <div
              ref={galleryRef}
              className="relative aspect-square w-full rounded-2xl overflow-hidden bg-card cursor-crosshair select-none touch-none"
              onMouseMove={handleGalleryMouseMove}
              onMouseLeave={handleGalleryMouseLeave}
            >
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  transformOrigin:
                    zoomOrigin !== null
                      ? `${zoomOrigin.x * 100}% ${zoomOrigin.y * 100}%`
                      : '50% 50%',
                  transform: zoomOrigin !== null ? 'scale(2.5)' : 'scale(1)',
                  transition: zoomOrigin !== null ? 'none' : 'transform 0.2s ease-out',
                }}
              >
                <img
                  src={currentSrc}
                  alt={product.name}
                  className="w-full h-full object-cover pointer-events-none"
                  draggable={false}
                  fetchPriority="high"
                />
              </div>
              {zoomOrigin !== null && (
                <div className="absolute inset-0 pointer-events-none border-2 border-primary/30 rounded-2xl" aria-hidden />
              )}
              <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-col gap-2 z-10">
                {product.isNew && <Badge className="text-xs">New Arrival</Badge>}
                {product.isTrending && <Badge variant="secondary" className="text-xs">Trending</Badge>}
              </div>
            </div>

            {allImages.length > 1 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
                {allImages.map((url, i) => (
                  <button
                    key={`${url}-${i}`}
                    type="button"
                    onClick={() => setCurrentImageIndex(i)}
                    className={`relative aspect-square w-full rounded-lg overflow-hidden border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                      i === currentImageIndex
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-transparent hover:border-muted-foreground/30'
                    }`}
                    aria-label={`View image ${i + 1} of ${allImages.length}`}
                    aria-pressed={i === currentImageIndex}
                  >
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">
                {product.category}
              </p>
              <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-foreground">
                {product.name}
              </h1>
              
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.floor(product.rating)
                          ? 'fill-primary text-primary'
                          : 'text-muted'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {product.rating} ({product.reviews} reviews)
                </span>
              </div>

              <p className="text-3xl font-bold text-primary">
                {CURRENCY} {product.price.toFixed(2)}
              </p>
            </div>

            <p className="text-muted-foreground leading-relaxed">
              {product.description}
            </p>

            {product.colors && (
              <div className="space-y-3">
                <label className="font-medium">Color: {selectedColor}</label>
                <div className="flex gap-3">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 rounded-lg border transition-all ${
                        selectedColor === color
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.sizes && (
              <div className="space-y-3">
                <label className="font-medium">Size: {selectedSize}</label>
                <div className="flex flex-wrap gap-3">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`w-12 h-12 rounded-lg border font-medium transition-all ${
                        selectedSize === size
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="font-medium">Quantity</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-lg border border-border hover:border-primary/50 transition-colors"
                >
                  -
                </button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 rounded-lg border border-border hover:border-primary/50 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                size="lg"
                className="flex-1"
                onClick={handleAddToCart}
                disabled={!product.inStock}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                {product.inStock ? 'Add to Cart' : 'Out of Stock'}
              </Button>
              <Button size="lg" variant="outline">
                <Heart className="h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline">
                <Share2 className="h-5 w-5" />
              </Button>
            </div>

            {isShirtCategory(product.category) ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="lg" variant="secondary" className="w-full">
                    <Camera className="h-5 w-5 mr-2" />
                    Try on
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem
                    onClick={() => navigate(`/virtual-try-on?product=${product.id}&mode=image`)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Using photo
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate(`/virtual-try-on?product=${product.id}&mode=camera`)}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Live camera
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border">
              <div className="text-center">
                <Truck className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">Free Shipping</p>
                <p className="text-xs text-muted-foreground">On orders over {CURRENCY} 100</p>
              </div>
              <div className="text-center">
                <RotateCcw className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">Easy Returns</p>
                <p className="text-xs text-muted-foreground">30-day policy</p>
              </div>
              <div className="text-center">
                <Shield className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">Secure Payment</p>
                <p className="text-xs text-muted-foreground">100% protected</p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="mt-16">
          <Tabs defaultValue="description">
            <TabsList className="w-full justify-start border-b border-border bg-transparent rounded-none p-0 h-auto">
              <TabsTrigger 
                value="description"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
              >
                Description
              </TabsTrigger>
              <TabsTrigger 
                value="reviews"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
              >
                Reviews ({product.reviews})
              </TabsTrigger>
              <TabsTrigger 
                value="shipping"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
              >
                Shipping & Returns
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="description" className="mt-6">
              <div className="prose prose-sm max-w-none">
                <p>{product.description}</p>
                {product.features && product.features.length > 0 ? (
                  <>
                    <h4 className="mt-4 font-semibold">Features</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      {product.features.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            </TabsContent>
            
            <TabsContent value="reviews" className="mt-6">
              <div className="space-y-6">
                {[1, 2, 3].map((review) => (
                  <div key={review} className="border-b border-border pb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                        ))}
                      </div>
                      <span className="font-medium">Great product!</span>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      Really happy with this purchase. The quality is amazing and it fits perfectly.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">- Customer {review}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="shipping" className="mt-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Free Standard Shipping</p>
                    <p className="text-sm text-muted-foreground">On orders over {CURRENCY} 100. Delivery in 5-7 business days.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Express Shipping Available</p>
                    <p className="text-sm text-muted-foreground">2-3 business days for an additional fee.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Easy Returns</p>
                    <p className="text-sm text-muted-foreground">30-day return policy. Items must be unworn with tags attached.</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {relatedProducts.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-serif font-bold mb-6">You might also like</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((p, index) => (
                <ProductCard key={p.id} product={p} index={index} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
