import { useState, useEffect } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { useStore } from '@/store/useStore';
import { CURRENCY } from '@/lib/constants';

interface SearchFiltersProps {
  onSearch: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onSortChange: (sort: string) => void;
  onPriceChange: (range: [number, number]) => void;
  selectedCategory: string;
  /** Dynamic categories from API; if not provided, uses default pills. */
  categories?: { value: string; label: string }[];
  /** Max price for slider (default 500). */
  priceMax?: number;
}

const defaultCategories = [
  { value: 'all', label: 'All Products' },
  { value: 'shirts', label: 'Shirts' },
  { value: 'pants', label: 'Pants' },
  { value: 'glasses', label: 'Glasses' },
  { value: 'watches', label: 'Watches' },
];

const sortOptions = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
];

// Simple spell correction for common words
const correctSpelling = (query: string): string => {
  const corrections: Record<string, string> = {
    'shrit': 'shirt',
    'shirts': 'shirt',
    'shirtt': 'shirt',
    'pant': 'pants',
    'panst': 'pants',
    'glases': 'glasses',
    'glasss': 'glasses',
    'wach': 'watch',
    'watchs': 'watches',
    'whatch': 'watch',
  };
  
  const words = query.toLowerCase().split(' ');
  const corrected = words.map(word => corrections[word] || word);
  return corrected.join(' ');
};

export function SearchFilters({
  onSearch,
  onCategoryChange,
  onSortChange,
  onPriceChange,
  selectedCategory,
  categories: categoriesProp,
  priceMax = 500,
}: SearchFiltersProps) {
  const categories = categoriesProp?.length
    ? [{ value: 'all', label: 'All Products' }, ...categoriesProp]
    : defaultCategories;
  const [query, setQuery] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, priceMax]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { searchHistory, addToSearchHistory } = useStore();

  useEffect(() => {
    const corrected = correctSpelling(query);
    if (corrected !== query.toLowerCase() && query.length > 2) {
      // Show correction suggestion
    }
    
    const debounce = setTimeout(() => {
      onSearch(corrected);
    }, 300);
    
    return () => clearTimeout(debounce);
  }, [query, onSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const corrected = correctSpelling(query);
    addToSearchHistory(corrected);
    onSearch(corrected);
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search products, categories, keywords..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            className="pl-10 pr-10 h-12 text-base"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => {
                setQuery('');
                onSearch('');
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Search Suggestions */}
        <AnimatePresence>
          {showSuggestions && searchHistory.length > 0 && !query && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-10 w-full mt-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
            >
              <div className="p-2">
                <p className="text-xs text-muted-foreground px-2 py-1">Recent Searches</p>
                {searchHistory.map((item, index) => (
                  <button
                    key={index}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-accent rounded-md transition-colors"
                    onClick={() => {
                      setQuery(item);
                      onSearch(item);
                      setShowSuggestions(false);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Category Pills */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => onCategoryChange(cat.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === cat.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Sort */}
        <Select onValueChange={onSortChange} defaultValue="featured">
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Advanced Filters */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              {/* Price Range */}
              <div className="space-y-4">
                <h4 className="font-medium">Price Range</h4>
                <Slider
                  value={priceRange}
                  onValueChange={(value) => {
                    setPriceRange(value as [number, number]);
                    onPriceChange(value as [number, number]);
                  }}
                  max={priceMax}
                  step={Math.max(1, Math.floor(priceMax / 50))}
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{CURRENCY} {priceRange[0]}</span>
                  <span>{CURRENCY} {priceRange[1]}</span>
                </div>
              </div>

              {/* Stock */}
              <div className="space-y-4">
                <h4 className="font-medium">Availability</h4>
                <div className="flex items-center gap-2">
                  <Checkbox id="inStock" />
                  <label htmlFor="inStock" className="text-sm">In Stock Only</label>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-4">
                <h4 className="font-medium">Features</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="customizable" />
                    <label htmlFor="customizable" className="text-sm">Customizable</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="trending" />
                    <label htmlFor="trending" className="text-sm">Trending</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="newArrivals" />
                    <label htmlFor="newArrivals" className="text-sm">New Arrivals</label>
                  </div>
                </div>
              </div>

              <Button className="w-full">Apply Filters</Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
