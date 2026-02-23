import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Send, 
  Mic, 
  Image as ImageIcon, 
  ShoppingCart,
  Package,
  TrendingUp,
  Search,
  X,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFeatureConfig } from '@/lib/featureConfig';
import { productsAPI, apiProductToProduct } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { ChatMessage, Product } from '@/lib/types';
import { toast } from 'sonner';

const quickActions = [
  { icon: TrendingUp, label: 'Trending Products', query: 'Show me trending products' },
  { icon: Package, label: 'New Arrivals', query: 'What are the new arrivals?' },
  { icon: Search, label: 'Search Products', query: 'Help me find a product' },
  { icon: ShoppingCart, label: 'Check Order', query: 'Check my order status' },
];

type ResponseKey = 'trending' | 'new' | 'shirts' | 'pants' | 'glasses' | 'watches' | 'order' | 'outofstock' | 'default';

const aiResponses: Record<ResponseKey, { text: string; filter?: (p: Product) => boolean; limit?: number }> = {
  trending: {
    text: "Here are the most trending products right now! These are flying off the shelves. Would you like me to add any of these to your cart?",
    filter: (p) => !!p.isTrending,
  },
  new: {
    text: "Check out our latest arrivals! Fresh styles just dropped. Let me know if you'd like more details on any of these.",
    filter: (p) => !!p.isNew,
  },
  shirts: {
    text: "We have an amazing collection of shirts! Here are some of our best sellers. You can also customize any of these in our 3D designer.",
    filter: (p) => p.category === 'shirts' || p.category?.toLowerCase().includes('shirt'),
  },
  pants: {
    text: "Here are our premium pants collection. Perfect fit guaranteed! Would you like me to help you find your size?",
    filter: (p) => p.category === 'pants' || p.category?.toLowerCase().includes('pant'),
  },
  glasses: {
    text: "Looking stylish! Here are our designer glasses. You can try them on virtually using our Virtual Try-On feature.",
    filter: (p) => p.category === 'glasses' || p.category?.toLowerCase().includes('glass'),
  },
  watches: {
    text: "Timeless elegance! Our watch collection features premium craftsmanship. Here are some favorites.",
    filter: (p) => p.category === 'watches' || p.category?.toLowerCase().includes('watch'),
  },
  order: {
    text: "I'd be happy to help you check your order status! Please provide your order number (e.g., ORD-001) and I'll look it up for you.",
  },
  outofstock: {
    text: "I apologize, but that specific item is currently out of stock. However, I found some similar products you might like! Would you like me to notify you when the original item is back in stock?",
    filter: (p) => p.inStock,
    limit: 3,
  },
  default: {
    text: "I'm your AI shopping assistant! I can help you find products, check orders, get recommendations, and even place orders on your behalf. What would you like to do today?",
  },
};

function parseQuery(query: string): ResponseKey {
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.includes('trending') || lowerQuery.includes('popular')) return 'trending';
  if (lowerQuery.includes('new') || lowerQuery.includes('arrival')) return 'new';
  if (lowerQuery.includes('shirt')) return 'shirts';
  if (lowerQuery.includes('pant')) return 'pants';
  if (lowerQuery.includes('glass') || lowerQuery.includes('sunglass')) return 'glasses';
  if (lowerQuery.includes('watch')) return 'watches';
  if (lowerQuery.includes('order') || lowerQuery.includes('status')) return 'order';
  if (lowerQuery.includes('out of stock') || lowerQuery.includes('unavailable')) return 'outofstock';
  return 'default';
}

export default function AIAssistant() {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { chatMessages, addChatMessage, addToCart, clearChat } = useStore();
  const { comingSoonEnabled } = useFeatureConfig();

  useEffect(() => {
    productsAPI
      .getList()
      .then((res) => setProducts((res.data ?? []).map(apiProductToProduct)))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    addChatMessage(userMessage);
    setInput('');
    setIsTyping(true);

    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

    const key = parseQuery(input);
    const response = aiResponses[key];
    let productList: Product[] | undefined;
    if (response.filter && products.length > 0) {
      productList = products.filter(response.filter);
      if (response.limit) productList = productList.slice(0, response.limit);
    }
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response.text,
      timestamp: new Date(),
      products: productList,
    };
    addChatMessage(assistantMessage);
    setIsTyping(false);
  };

  const handleQuickAction = (query: string) => {
    setInput(query);
    setTimeout(() => handleSend(), 100);
  };

  const handleAddProductToCart = (product: Product) => {
    addToCart({
      product,
      quantity: 1,
      size: product.sizes?.[0],
      color: product.colors?.[0],
    });
    toast.success(`${product.name} added to cart!`);
    
    const confirmMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `Great choice! I've added ${product.name} to your cart. Would you like to continue shopping or proceed to checkout?`,
      timestamp: new Date(),
    };
    addChatMessage(confirmMessage);
  };

  return (
    <div className="min-h-screen py-8 relative">
      {/* Coming Soon overlay: blur + disabled interactions when flag is on */}
      {comingSoonEnabled && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md"
          aria-live="polite"
        >
          <div className="text-center px-6 max-w-md">
            <h2 className="text-2xl md:text-3xl font-serif font-bold mb-2">Coming Soon</h2>
            <p className="text-muted-foreground">
              Our AI Shopping Assistant is on its way. You’ll soon get product recommendations, order help, and quick answers. Stay tuned.
            </p>
          </div>
        </div>
      )}
      <div className={`container mx-auto px-4 max-w-4xl ${comingSoonEnabled ? 'pointer-events-none select-none' : ''}`}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-serif font-bold">AI Shopping Assistant</h1>
                <p className="text-sm text-muted-foreground">
                  Ask me anything about products, orders, or recommendations
                </p>
              </div>
            </div>
            {chatMessages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearChat}>
                <X className="h-4 w-4 mr-1" />
                Clear Chat
              </Button>
            )}
          </div>
        </motion.div>

        {/* Chat Container */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden flex flex-col h-[600px]">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Hello! I'm your AI Assistant</h2>
                <p className="text-muted-foreground mb-8 max-w-md">
                  I can help you find products, check orders, get personalized recommendations, 
                  and even place orders on your behalf. Try one of these:
                </p>
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action.query)}
                      className="flex items-center gap-2 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-left"
                    >
                      <action.icon className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {chatMessages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl p-4 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        
                        {/* Product Cards */}
                        {message.products && message.products.length > 0 && (
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            {message.products.map((product) => (
                              <div
                                key={product.id}
                                className="bg-card rounded-lg p-2 border border-border"
                              >
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="w-full aspect-square object-cover rounded-md mb-2"
                                />
                                <p className="text-xs font-medium text-foreground line-clamp-1">
                                  {product.name}
                                </p>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-xs font-bold text-primary">
                                    ${product.price}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-6 text-xs px-2"
                                    onClick={() => handleAddProductToCart(product)}
                                  >
                                    Add
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <p className="text-xs opacity-70 mt-2">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Typing Indicator */}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2"
                  >
                    <div className="bg-muted rounded-full px-4 py-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce delay-100" />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce delay-200" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Quick Actions Bar */}
          {chatMessages.length > 0 && (
            <div className="px-4 py-2 border-t border-border bg-muted/30">
              <div className="flex gap-2 overflow-x-auto">
                {quickActions.map((action) => (
                  <Badge
                    key={action.label}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors whitespace-nowrap"
                    onClick={() => handleQuickAction(action.query)}
                  >
                    <action.icon className="h-3 w-3 mr-1" />
                    {action.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-border">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-3"
            >
              <Button type="button" variant="ghost" size="icon">
                <ImageIcon className="h-5 w-5" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1"
              />
              <Button type="button" variant="ghost" size="icon">
                <Mic className="h-5 w-5" />
              </Button>
              <Button type="submit" disabled={!input.trim() || isTyping}>
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
