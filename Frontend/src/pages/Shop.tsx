import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SearchFilters } from '@/components/product/SearchFilters';
import { ProductCard } from '@/components/product/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { productsAPI, categoriesAPI, apiProductToProduct, type CategoryPublic } from '@/lib/api';
import type { Product } from '@/lib/types';

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCategory = searchParams.get('category') ?? '';
  const urlFilter = searchParams.get('filter') ?? '';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(urlCategory || 'all');
  const [sortBy, setSortBy] = useState(urlFilter || 'featured');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [visibleCount, setVisibleCount] = useState(8);

  useEffect(() => {
    const categorySlug = selectedCategory !== 'all' ? selectedCategory : undefined;
    productsAPI
      .getList(categorySlug ? { categorySlug } : {})
      .then((res) => setProducts((res.data ?? []).map(apiProductToProduct)))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load products'))
      .finally(() => setLoading(false));
  }, [selectedCategory]);

  useEffect(() => {
    categoriesAPI.getList().then((res) => setCategories(res.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (urlCategory && urlCategory !== selectedCategory) setSelectedCategory(urlCategory);
  }, [urlCategory]);

  const priceMax = useMemo(() => {
    if (products.length === 0) return 500;
    return Math.max(...products.map((p) => p.price), 500);
  }, [products]);

  useEffect(() => {
    setPriceRange((prev) => [prev[0], Math.min(prev[1], priceMax)] as [number, number]);
  }, [priceMax]);

  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== 'all') {
      list = list.filter((p) => p.category === selectedCategory);
    }

    list = list.filter((p) => p.price >= priceRange[0] && p.price <= priceRange[1]);

    switch (sortBy) {
      case 'newest':
        list = [...list].sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
        break;
      case 'price-low':
        list = [...list].sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        list = [...list].sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        list = [...list].sort((a, b) => b.rating - a.rating);
        break;
      default:
        list = [...list].sort((a, b) => (b.isTrending ? 1 : 0) - (a.isTrending ? 1 : 0));
    }

    return list;
  }, [products, searchQuery, selectedCategory, sortBy, priceRange]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProducts.length;

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + 8);
  }, []);

  const handleCategoryChange = useCallback(
    (slug: string) => {
      setSelectedCategory(slug);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (slug === 'all') next.delete('category');
        else next.set('category', slug);
        return next;
      });
    },
    [setSearchParams]
  );

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-serif font-bold mb-2">Shop All Products</h1>
          <p className="text-muted-foreground">
            Discover our collection of premium fashion items
          </p>
        </motion.div>

        {/* Search & Filters */}
        <SearchFilters
          onSearch={setSearchQuery}
          onCategoryChange={handleCategoryChange}
          onSortChange={setSortBy}
          onPriceChange={setPriceRange}
          selectedCategory={selectedCategory}
          categories={categories.map((c) => ({ value: c.slug, label: c.name }))}
          priceMax={priceMax}
        />

        {/* Results Count */}
        <div className="my-6 text-sm text-muted-foreground">
          Showing {visibleProducts.length} of {filteredProducts.length} products
        </div>

        {/* Loading / Error / Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
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
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-xl text-destructive">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">Try refreshing the page</p>
          </div>
        ) : filteredProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {visibleProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="mt-12 text-center">
                <button
                  onClick={handleLoadMore}
                  className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  Load More Products
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-xl text-muted-foreground">No products found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
