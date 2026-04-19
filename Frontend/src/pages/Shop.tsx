import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { SearchFilters } from '@/components/product/SearchFilters';
import { ProductCard } from '@/components/product/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { productsAPI, categoriesAPI, apiProductToProduct, type CategoryPublic } from '@/lib/api';
import { frontendProductsListKey } from '@/lib/queryClient';
import {
  getCommonProductTagsForFilters,
  productMatchesTagFilters,
} from '@/lib/productTagFilters';
import type { Product } from '@/lib/types';

const SHOP_VISIBLE_KEY = 'nextfit-shop-visible-';

function readStoredVisible(slug: string): number {
  try {
    const v = sessionStorage.getItem(`${SHOP_VISIBLE_KEY}${slug}`);
    if (v == null) return 8;
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || n < 8) return 8;
    return n;
  } catch {
    return 8;
  }
}

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCategory = searchParams.get('category') ?? '';
  const urlFilter = searchParams.get('filter') ?? '';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(urlCategory || 'all');
  const [sortBy, setSortBy] = useState(urlFilter || 'featured');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const initialListSlug = (urlCategory || 'all') === 'all' ? 'all' : urlCategory;
  const [visibleCount, setVisibleCount] = useState(() => readStoredVisible(initialListSlug));
  const defaultPriceCapRef = useRef(500);

  const listSlug = selectedCategory === 'all' ? 'all' : selectedCategory;
  const productsQuery = useQuery({
    queryKey: frontendProductsListKey(listSlug),
    queryFn: () =>
      productsAPI
        .getList(listSlug === 'all' ? {} : { categorySlug: listSlug })
        .then((res) => (res.data ?? []).map(apiProductToProduct)),
  });
  const products: Product[] = productsQuery.data ?? [];
  const loading = productsQuery.isPending;
  const error =
    productsQuery.error instanceof Error
      ? productsQuery.error.message
      : productsQuery.error
        ? String(productsQuery.error)
        : null;

  const categoriesQuery = useQuery({
    queryKey: ['frontend', 'categories'],
    queryFn: () => categoriesAPI.getList().then((res) => res.data ?? []),
  });
  const categories: CategoryPublic[] = categoriesQuery.data ?? [];

  useEffect(() => {
    if (urlCategory && urlCategory !== selectedCategory) setSelectedCategory(urlCategory);
  }, [urlCategory]);

  useEffect(() => {
    setVisibleCount(readStoredVisible(listSlug));
  }, [listSlug]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`${SHOP_VISIBLE_KEY}${listSlug}`, String(visibleCount));
    } catch {
    }
  }, [visibleCount, listSlug]);

  const priceMax = useMemo(() => {
    if (products.length === 0) return 500;
    return Math.max(...products.map((p) => p.price), 500);
  }, [products]);

  const tagFilterOptions = useMemo(() => getCommonProductTagsForFilters(products), [products]);

  useEffect(() => {
    const allowed = new Set(tagFilterOptions.map((o) => o.value));
    setSelectedTags((prev) => prev.filter((t) => allowed.has(t)));
  }, [tagFilterOptions]);

  useEffect(() => {
    setPriceRange((prev) => {
      const lo = Math.min(prev[0], priceMax);
      const stillDefaultCeiling = prev[1] === defaultPriceCapRef.current;
      const hi = stillDefaultCeiling
        ? priceMax
        : Math.min(prev[1], priceMax);
      defaultPriceCapRef.current = priceMax;
      return [lo, Math.max(lo, hi)] as [number, number];
    });
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

    if (inStockOnly) {
      list = list.filter((p) => p.inStock);
    }

    if (selectedTags.length > 0) {
      list = list.filter((p) => productMatchesTagFilters(p.tags, selectedTags));
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
  }, [products, searchQuery, selectedCategory, sortBy, priceRange, inStockOnly, selectedTags]);

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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-serif font-bold mb-2 text-foreground">Shop All Products</h1>
          <p className="text-muted-foreground">
            Discover our collection of premium fashion items
          </p>
        </motion.div>

        <SearchFilters
          onSearch={setSearchQuery}
          onCategoryChange={handleCategoryChange}
          onSortChange={setSortBy}
          onPriceChange={setPriceRange}
          selectedCategory={selectedCategory}
          sortBy={sortBy}
          priceRange={priceRange}
          categories={categories.map((c) => ({ value: c.slug, label: c.name }))}
          priceMax={priceMax}
          tagOptions={tagFilterOptions}
          selectedTags={selectedTags}
          onSelectedTagsChange={setSelectedTags}
          inStockOnly={inStockOnly}
          onInStockOnlyChange={setInStockOnly}
        />

        <div className="my-6 text-sm text-muted-foreground">
          Showing {visibleProducts.length} of {filteredProducts.length} products
        </div>

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
