import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Palette, Camera, Bot, TrendingUp, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard } from '@/components/product/ProductCard';
import { useFeatureConfig } from '@/lib/featureConfig';
import { categoriesAPI, productsAPI, apiProductToProduct, type CategoryPublic } from '@/lib/api';
import type { Product } from '@/lib/types';
import heroBanner from '@/assets/hero-banner.jpg';

const features = [
  {
    icon: Palette,
    title: '3D Customization',
    description: 'Design your unique shirt with our interactive 3D customizer. Apply colors, patterns, and elements.',
    comingSoon: true,
    path: '/customize',
  },
  {
    icon: Camera,
    title: 'Virtual Try-On',
    description: 'See how products look on you using AR technology. Try before you buy.',
    comingSoon: false,
    path: '/virtual-try-on',
  },
  {
    icon: Bot,
    title: 'AI Shopping Assistant',
    description: 'Get personalized recommendations and order products through our intelligent assistant.',
    comingSoon: true,
    path: '/assistant',
  },
  {
    icon: Shield,
    title: 'Premium Quality',
    description: 'Handcrafted products with premium materials. 100% satisfaction guaranteed.',
    comingSoon: false,
    path: null,
  },
];

export default function Index() {
  const { comingSoonEnabled } = useFeatureConfig();
  const [categories, setCategories] = useState<CategoryPublic[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState<string | null>(null);

  useEffect(() => {
    categoriesAPI
      .getList()
      .then((res) => setCategories(res.data ?? []))
      .catch((err) => setCategoriesError(err instanceof Error ? err.message : 'Failed to load categories'))
      .finally(() => setCategoriesLoading(false));
  }, []);

  useEffect(() => {
    productsAPI
      .getFeatured()
      .then((res) => setFeaturedProducts((res.data ?? []).map(apiProductToProduct)))
      .catch((err) => setFeaturedError(err instanceof Error ? err.message : 'Failed to load featured products'))
      .finally(() => setFeaturedLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroBanner}
            alt="NextFit Fashion"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/90 via-foreground/70 to-transparent" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">
              <Sparkles className="h-3 w-3 mr-1" />
              New Collection 2024
            </Badge>
            
            <h1 className="text-5xl md:text-7xl font-serif font-bold text-primary-foreground mb-6 leading-tight">
              Forge Your
              <span className="block text-primary">Unique Style</span>
            </h1>
            
            <p className="text-xl text-primary-foreground/80 mb-8 leading-relaxed">
              Experience fashion like never before. Customize your own shirts with our 3D designer, 
              try products virtually, and get AI-powered recommendations.
            </p>
            
            <div className="flex flex-wrap gap-4 items-center">
              <Link to="/shop">
                <Button size="lg" className="text-lg px-8">
                  Shop Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              {comingSoonEnabled ? (
                <div className="flex items-center gap-2">
                  <Button size="lg" variant="outline" className="text-lg px-8 bg-background/10 border-primary-foreground/30 text-primary-foreground opacity-80 cursor-not-allowed" disabled>
                    Start Customizing
                    <Palette className="ml-2 h-5 w-5" />
                  </Button>
                  <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30">
                    Coming Soon
                  </Badge>
                </div>
              ) : (
                <Link to="/customize">
                  <Button size="lg" variant="outline" className="text-lg px-8 bg-background/10 border-primary-foreground/30 text-primary-foreground hover:bg-background/20">
                    Start Customizing
                    <Palette className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
              Why Choose NextFit?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              We combine cutting-edge technology with premium fashion to deliver an unmatched shopping experience.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const isComingSoon = feature.comingSoon && comingSoonEnabled;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative text-center p-6 rounded-xl bg-background border border-border transition-all ${
                    isComingSoon ? 'opacity-90' : 'hover:border-primary/50'
                  }`}
                >
                  {isComingSoon && (
                    <Badge variant="secondary" className="absolute top-3 right-3 text-[10px] px-2 py-0 font-normal">
                      Coming Soon
                    </Badge>
                  )}
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-2">
                Shop by Category
              </h2>
              <p className="text-muted-foreground">Find exactly what you're looking for</p>
            </div>
            <Link to="/shop">
              <Button variant="ghost">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {categoriesLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="relative rounded-2xl overflow-hidden">
                  <Skeleton className="aspect-square w-full rounded-2xl" />
                  <div className="absolute bottom-4 left-4 right-4 space-y-2">
                    <Skeleton className="h-6 w-3/4 rounded" />
                    <Skeleton className="h-4 w-1/2 rounded" />
                  </div>
                </div>
              ))
            ) : categoriesError ? (
              <p className="col-span-2 lg:col-span-4 text-center text-destructive py-8">{categoriesError}</p>
            ) : categories.length === 0 ? (
              <p className="col-span-2 lg:col-span-4 text-center text-muted-foreground py-8">No categories yet.</p>
            ) : (
              categories.slice(0, 4).map((category, index) => (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link
                    to={`/shop?category=${encodeURIComponent(category.slug)}`}
                    className="group block relative aspect-square rounded-2xl overflow-hidden"
                  >
                    <img
                      src={category.imageUrl}
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-xl font-semibold text-primary-foreground">{category.name}</h3>
                      <p className="text-primary-foreground/70 text-sm">{category.productCount} Products</p>
                    </div>
                  </Link>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Featured Products (4: at least 1 tagged + latest from server) */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <h2 className="text-3xl md:text-4xl font-serif font-bold">Featured</h2>
                <p className="text-muted-foreground">Handpicked and latest from our collection</p>
              </div>
            </div>
            <Link to="/shop">
              <Button variant="ghost">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          {featuredLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-border">
                  <Skeleton className="aspect-square w-full" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-6 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : featuredError ? (
            <p className="text-center text-destructive py-8">{featuredError}</p>
          ) : featuredProducts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No featured products yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-primary-foreground mb-6">
              Ready to Create Your Masterpiece?
            </h2>
            <p className="text-primary-foreground/80 text-lg mb-8 max-w-2xl mx-auto">
              Start designing your custom shirt now. Unleash your creativity with our 3D customizer.
            </p>
            {comingSoonEnabled ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button size="lg" variant="secondary" className="text-lg px-10 opacity-80 cursor-not-allowed" disabled>
                  Start Customizing Now
                  <Palette className="ml-2 h-5 w-5" />
                </Button>
                <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30">
                  Coming Soon
                </Badge>
              </div>
            ) : (
              <Link to="/customize">
                <Button size="lg" variant="secondary" className="text-lg px-10">
                  Start Customizing Now
                  <Palette className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            )}
          </motion.div>
        </div>
      </section>
    </div>
  );
}
