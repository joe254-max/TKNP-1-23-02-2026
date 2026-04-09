import React, { useState, useEffect, useMemo } from 'react';
import { 
  Utensils, 
  Search, 
  ShoppingCart, 
  Clock, 
  User as UserIcon, 
  ChevronRight, 
  Plus, 
  Minus, 
  X, 
  CheckCircle2, 
  CreditCard, 
  Smartphone, 
  History, 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  Menu as MenuIcon, 
  ArrowLeft, 
  Filter, 
  Star, 
  TrendingUp, 
  AlertCircle, 
  Database, 
  QrCode, 
  FileText, 
  Trash2, 
  Edit3, 
  Save, 
  ArrowUp,
  Package,
  Check,
  Loader2,
  Tag,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { requireSupabase } from './supabase';
import { MenuItem, CartItem, Order, User } from './types';
import { initiateStkPush } from './services/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Mock Data for Initial Load ---
const INITIAL_MENU: MenuItem[] = [
  {
    id: '1',
    name: 'Ugali & Sukuma Wiki',
    description: 'Traditional Kenyan staple served with sautéed kale and onions.',
    price: 50,
    category: 'Main Staples',
    image_url: 'https://picsum.photos/seed/ugali/400/300',
    is_available: true,
    rating: 4.8,
    tags: ['Vegetarian', 'Gluten-Free', 'Healthy'],
    containers: [
      { name: 'Plate', price: 50 },
      { name: 'Takeaway', price: 60 }
    ]
  },
  {
    id: '2',
    name: 'Beef Stew',
    description: 'Slow-cooked tender beef in a rich tomato and onion gravy.',
    price: 120,
    category: 'Proteins',
    image_url: 'https://picsum.photos/seed/beef/400/300',
    is_available: true,
    rating: 4.5,
    tags: ['High Protein', 'Spicy'],
    containers: [
      { name: 'Plate', price: 120 },
      { name: 'Takeaway', price: 130 }
    ]
  },
  {
    id: '3',
    name: 'Chapati (2pcs)',
    description: 'Soft, layered handmade flatbread.',
    price: 30,
    category: 'Snacks & Breads',
    image_url: 'https://picsum.photos/seed/chapati/400/300',
    is_available: true,
    rating: 4.9,
    tags: ['Vegetarian', 'Snack'],
    containers: [
      { name: 'Plate', price: 30 },
      { name: 'Takeaway', price: 40 }
    ]
  },
  {
    id: '4',
    name: 'Pilau Special',
    description: 'Fragrant spiced rice served with kachumbari and a side of beef.',
    price: 150,
    category: 'Main Staples',
    image_url: 'https://picsum.photos/seed/pilau/400/300',
    is_available: true,
    rating: 4.7,
    tags: ['Spicy', 'Popular'],
    containers: [
      { name: 'Plate', price: 150 },
      { name: 'Takeaway', price: 160 }
    ]
  },
  {
    id: '5',
    name: 'Fresh Mango Juice',
    description: 'Chilled natural mango juice made from local orchard fruits.',
    price: 40,
    category: 'Beverages',
    image_url: 'https://picsum.photos/seed/mango/400/300',
    is_available: true,
    rating: 4.6,
    tags: ['Vegan', 'Refreshing'],
    containers: [
      { name: 'Small Cup', price: 40 },
      { name: 'Large Cup', price: 70 }
    ]
  },
  {
    id: '6',
    name: 'Githeri',
    description: 'A nutritious mix of maize and beans seasoned with local herbs.',
    price: 60,
    category: 'Main Staples',
    image_url: 'https://picsum.photos/seed/githeri/400/300',
    is_available: true,
    rating: 4.4,
    tags: ['Vegetarian', 'High Fiber'],
    containers: [
      { name: 'Plate', price: 60 },
      { name: 'Takeaway', price: 70 }
    ]
  }
];

export default function App() {
  // --- State ---
  const [view, setView] = useState<'customer' | 'vendor'>('customer');
  const [activeTab, setActiveTab] = useState<'home' | 'menu' | 'orders' | 'profile' | 'cart'>('home');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [minRating, setMinRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<User | null>({
    user_id: 'user_123',
    full_name: 'John Doe',
    phone_number: '254712345678',
    role: 'admin'
  });
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');

  useEffect(() => {
    if (user?.phone_number) {
      setPhoneNumber(user.phone_number);
    }
  }, [user?.phone_number]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [pickedItems, setPickedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isCartOpen) {
      setCheckoutStatus('idle');
      setCheckoutError(null);
    }
  }, [isCartOpen]);

  const handleOrder = (item: MenuItem, container?: { name: string; price: number }) => {
    addToCart(item, container);
    const key = container ? `${item.id}-${container.name}` : item.id;
    setPickedItems(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setPickedItems(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  // --- Supabase Sync ---
  useEffect(() => {
    const supabase = requireSupabase();
    let cancelled = false;
    let didSeedMenu = false;

    const sync = async () => {
      try {
        const { data: menuItems, error: menuErr } = await supabase.from('menu').select('*');
        if (!cancelled) {
          if (menuErr) {
            console.error('Menu sync error:', menuErr);
          } else if (menuItems && menuItems.length === 0) {
            // Seed initial data if empty (for demo)
            if (!didSeedMenu) {
              didSeedMenu = true;
              setMenu(INITIAL_MENU);
            }
          } else if (menuItems) {
            setMenu(menuItems as MenuItem[]);
          }
        }

        const { data: orderItems, error: ordersErr } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (!cancelled && !ordersErr && orderItems) {
          setOrders(orderItems as Order[]);
        }

        if (!cancelled && ordersErr) {
          console.error('Orders sync error:', ordersErr);
        }
      } catch (err) {
        if (!cancelled) console.error('Supabase sync failed:', err);
      }
    };

    void sync();
    const intervalId = window.setInterval(() => void sync(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  // --- Scroll Listener ---
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- Derived State ---
  const categories = ['All', 'Main Staples', 'Vegetables', 'Proteins', 'Beverages', 'Snacks & Breads', 'Combos'];
  
  const filteredMenu = useMemo(() => {
    return menu.filter(item => {
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPrice = item.price >= priceRange[0] && item.price <= priceRange[1];
      const matchesRating = (item.rating || 0) >= minRating;
      const matchesTags = selectedTags.length === 0 || 
                         selectedTags.every(tag => item.tags?.includes(tag));
      
      return matchesCategory && matchesSearch && matchesPrice && matchesRating && matchesTags;
    });
  }, [menu, activeCategory, searchQuery, priceRange, minRating, selectedTags]);

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // --- Handlers ---
  const addToCart = (item: MenuItem, container?: { name: string; price: number }) => {
    setCart(prev => {
      const cartItemId = container ? `${item.id}-${container.name}` : item.id;
      const existing = prev.find(i => (i.selectedContainer ? `${i.id}-${i.selectedContainer.name}` : i.id) === cartItemId);
      
      if (existing) {
        return prev.map(i => (i.selectedContainer ? `${i.id}-${i.selectedContainer.name}` : i.id) === cartItemId 
          ? { ...i, quantity: i.quantity + 1 } 
          : i
        );
      }
      
      const priceToUse = container ? container.price : item.price;
      return [...prev, { ...item, price: priceToUse, quantity: 1, selectedContainer: container }];
    });
  };

  const removeFromCart = (id: string, containerName?: string) => {
    setCart(prev => {
      const cartItemId = containerName ? `${id}-${containerName}` : id;
      const existing = prev.find(i => (i.selectedContainer ? `${i.id}-${i.selectedContainer.name}` : i.id) === cartItemId);
      
      if (existing && existing.quantity > 1) {
        return prev.map(i => (i.selectedContainer ? `${i.id}-${i.selectedContainer.name}` : i.id) === cartItemId 
          ? { ...i, quantity: i.quantity - 1 } 
          : i
        );
      }
      return prev.filter(i => (i.selectedContainer ? `${i.id}-${i.selectedContainer.name}` : i.id) !== cartItemId);
    });
  };

  const handleCheckout = async () => {
    if (!user || cart.length === 0) return;

    // Validate phone number
    const phoneRegex = /^254[17]\d{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
      setCheckoutError("Please enter a valid M-Pesa number (e.g., 254712345678)");
      setCheckoutStatus('error');
      setTimeout(() => {
        setCheckoutStatus('idle');
        setCheckoutError(null);
      }, 5000);
      return;
    }

    setIsCheckoutLoading(true);
    setCheckoutStatus('pending');

    try {
      const supabase = requireSupabase();

      // 1. Create Order in Supabase
      const orderData = {
        user_id: user.user_id,
        full_name: user.full_name,
        phone_number: phoneNumber,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          container: item.selectedContainer?.name || null
        })),
        total_amount: cartTotal,
        status: 'PENDING',
        payment_status: 'PENDING',
        created_at: new Date().toISOString()
      };

      const { data: insertedOrder, error: insertErr } = await supabase
        .from('orders')
        .insert(orderData)
        .select('id')
        .single();

      if (insertErr) throw insertErr;
      const orderId = insertedOrder?.id;

      // 2. Initiate M-Pesa STK Push
      const response = await initiateStkPush(cartTotal, phoneNumber, orderId);
      
      if (response && response.ResponseCode === "0") {
        // Update order with CheckoutRequestID
        await supabase
          .from('orders')
          .update({ checkout_request_id: response.CheckoutRequestID })
          .eq('id', orderId);
        setCheckoutStatus('success');
        setCheckoutError(null);
        setCart([]);
        setTimeout(() => {
          setIsCartOpen(false);
          setActiveTab('orders');
          setCheckoutStatus('idle');
        }, 3000);
      } else {
        const errorMsg = response?.CustomerMessage || "Payment initiation failed. Please check your phone number and try again.";
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error("Checkout Error:", error);
      setCheckoutStatus('error');
      setCheckoutError(error.message || "Something went wrong. Please try again.");
      setTimeout(() => {
        setCheckoutStatus('idle');
        setCheckoutError(null);
      }, 5000);
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      const supabase = requireSupabase();
      await supabase.from('orders').update({ status }).eq('id', orderId);
    } catch (error) {
      console.error("Update Status Error:", error);
    }
  };

  // --- Components ---

  const Navbar = () => (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between lg:hidden">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-red-900 rounded-lg flex items-center justify-center text-white">
          <Utensils size={18} />
        </div>
        <span className="font-bold text-lg tracking-tight">FoodHub</span>
      </div>
      <div className="flex items-center gap-3">
        <button 
          onClick={() => { setActiveTab('menu'); document.getElementById('search-input')?.focus(); }}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Search size={20} />
        </button>
        <button 
          onClick={() => setIsCartOpen(true)}
          className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ShoppingCart size={20} />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-900 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  );

  const Sidebar = () => (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-100 z-50 hidden lg:flex flex-col p-6">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 bg-red-900 rounded-xl flex items-center justify-center text-white shadow-xl shadow-red-900/20">
          <Utensils size={24} />
        </div>
        <div>
          <h1 className="font-bold text-xl leading-none text-gray-900 tracking-tight">FoodHub</h1>
          <p className="text-[10px] text-red-900 font-black uppercase tracking-[0.2em] mt-1">Polytechnic</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {view === 'customer' ? (
          <>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2">Main Menu</div>
            {[
              { id: 'home', label: 'Home', icon: LayoutDashboard },
              { id: 'menu', label: 'Menu', icon: Utensils },
              { id: 'orders', label: 'My Orders', icon: History },
              { id: 'profile', label: 'Profile', icon: UserIcon },
            ].map((item) => (
              <button 
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all duration-200 group",
                  activeTab === item.id 
                    ? "bg-red-900 text-white shadow-lg shadow-red-900/20" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon size={20} className={cn(
                  activeTab === item.id ? "text-white" : "text-gray-400 group-hover:text-red-900"
                )} />
                {item.label}
              </button>
            ))}
          </>
        ) : (
          <>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2">Vendor Portal</div>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold bg-gray-900 text-white shadow-lg">
              <Database size={20} />
              Dashboard
            </button>
            <button 
              onClick={() => document.getElementById('vendor-menu')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all group"
            >
              <Utensils size={20} className="text-gray-400 group-hover:text-red-900" />
              Menu Editor
            </button>
            <button 
              onClick={() => document.getElementById('vendor-orders')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all group"
            >
              <Clock size={20} className="text-gray-400 group-hover:text-red-900" />
              Live Orders
            </button>
          </>
        )}

        <div className="pt-6 mt-6 border-t border-gray-100">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2">Switch View</div>
          <button 
            onClick={() => setView(view === 'customer' ? 'vendor' : 'customer')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all group"
          >
            <QrCode size={20} className="text-gray-400 group-hover:text-red-900" />
            {view === 'vendor' ? 'Customer App' : 'Vendor Portal'}
          </button>
        </div>
      </nav>

      <div className="mt-auto p-4 bg-gray-50 rounded-3xl border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-gray-400 shadow-sm border border-gray-100">
            <UserIcon size={20} />
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold truncate text-gray-900">{user?.full_name}</p>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{user?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );

  const BottomNav = () => (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-between z-50 lg:hidden">
      {[
        { id: 'home', icon: LayoutDashboard, label: 'Home' },
        { id: 'menu', icon: Utensils, label: 'Menu' },
        { id: 'orders', icon: History, label: 'Orders' },
        { id: 'profile', icon: UserIcon, label: 'Profile' },
      ].map((item) => (
        <button 
          key={item.id}
          onClick={() => setActiveTab(item.id as any)}
          className={cn(
            "flex flex-col items-center gap-1 transition-all duration-200",
            activeTab === item.id ? "text-red-900 scale-110" : "text-gray-400"
          )}
        >
          <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} />
          <span className="text-[10px] font-bold">{item.label}</span>
        </button>
      ))}
      {view === 'vendor' && (
        <button 
          onClick={() => setView('customer')}
          className="flex flex-col items-center gap-1 text-gray-900"
        >
          <QrCode size={20} />
          <span className="text-[10px] font-bold">Exit</span>
        </button>
      )}
    </nav>
  );



  // --- Main Views ---

  const CustomerHome = () => (
    <div className="space-y-8 pb-10">
      {/* Hero */}
      <section className="relative h-64 lg:h-80 rounded-[2rem] overflow-hidden group">
        <img 
          src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop" 
          alt="Delicious Food" 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent flex flex-col justify-center p-8 lg:p-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <span className="inline-block px-3 py-1 bg-red-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full mb-4">
              Special Offer
            </span>
            <h2 className="text-3xl lg:text-5xl font-black text-white leading-tight mb-4 max-w-md">
              Fresh Meals for <span className="text-red-500">Smart Minds</span>
            </h2>
            <p className="text-gray-300 text-sm lg:text-base max-w-sm mb-6">
              Get your favorite campus meals delivered or ready for pickup in minutes.
            </p>
            <button 
              onClick={() => setActiveTab('menu')}
              className="px-8 py-3 bg-white text-gray-900 rounded-2xl font-bold hover:bg-red-900 hover:text-white transition-all shadow-xl"
            >
              Order Now
            </button>
          </motion.div>
        </div>
      </section>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Avg. Prep Time', value: '15 min', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Active Vendors', value: '12', icon: Utensils, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Happy Students', value: '2.4k', icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Daily Orders', value: '450+', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
            className="p-4 bg-white rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4"
          >
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.bg, stat.color)}>
              <stat.icon size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-lg font-black text-gray-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Trending Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-gray-900">Trending Now</h3>
          <button onClick={() => setActiveTab('menu')} className="text-sm font-bold text-red-900 flex items-center gap-1">
            View All <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menu.slice(0, 3).map((item, i) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + (0.1 * i) }}
              className="bg-white rounded-[2rem] overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all group"
            >
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={item.image_url} 
                  alt={item.name} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-xs font-bold text-gray-900 shadow-sm">
                  KES {item.price}
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-red-50 text-red-900 text-[10px] font-bold rounded-md uppercase tracking-wider">
                    {item.category}
                  </span>
                  {item.rating && (
                    <div className="flex items-center gap-0.5 text-yellow-400">
                      <Star size={12} fill="currentColor" />
                      <span className="text-[10px] font-bold text-gray-900">{item.rating}</span>
                    </div>
                  )}
                </div>
                <h4 className="text-lg font-black text-gray-900 mb-2">{item.name}</h4>
                <p className="text-xs text-gray-400 line-clamp-2 mb-3">{item.description}</p>
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {item.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 bg-gray-50 text-gray-400 text-[8px] font-bold rounded uppercase tracking-tighter border border-gray-100">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <button 
                  onClick={() => handleOrder(item)}
                  className="w-full py-3 bg-gray-50 text-gray-900 rounded-xl font-bold hover:bg-red-900 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  {pickedItems[item.id] ? (
                    <span className="text-green-600 flex items-center gap-2"><Check size={18} /> Picked</span>
                  ) : (
                    <><Plus size={18} /> Order</>
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );

  const CustomerMenu = () => {
    const allTags = useMemo(() => {
      const tags = new Set<string>();
      menu.forEach(item => item.tags?.forEach(tag => tags.add(tag)));
      return Array.from(tags);
    }, [menu]);

    return (
      <div className="space-y-6 pb-10">
        {/* Search & Filter Header */}
        <div className="sticky top-0 z-30 bg-gray-50/80 backdrop-blur-md py-4 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                id="search-input"
                type="text" 
                placeholder="Search for meals, snacks, or drinks..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-red-900/20 focus:border-red-900 outline-none transition-all font-medium"
              />
            </div>
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={cn(
                "p-4 rounded-2xl border transition-all flex items-center justify-center gap-2",
                isFilterOpen || minRating > 0 || selectedTags.length > 0 || priceRange[0] > 0 || priceRange[1] < 500
                  ? "bg-red-900 text-white border-red-900 shadow-lg shadow-red-900/20" 
                  : "bg-white text-gray-500 border-gray-100 hover:border-red-900 hover:text-red-900"
              )}
            >
              <SlidersHorizontal size={20} />
              <span className="hidden md:inline font-bold">Filters</span>
            </button>
          </div>

          <AnimatePresence>
            {isFilterOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xl space-y-6 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Price Range */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-sm text-gray-900">Price Range</h5>
                        <span className="text-xs font-bold text-red-900 bg-red-50 px-2 py-1 rounded-lg">
                          KES {priceRange[0]} - {priceRange[1]}
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="500" 
                        step="10"
                        value={priceRange[1]}
                        onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                        className="w-full accent-red-900 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <span>Min: KES 0</span>
                        <span>Max: KES 500</span>
                      </div>
                    </div>

                    {/* Minimum Rating */}
                    <div className="space-y-4">
                      <h5 className="font-bold text-sm text-gray-900">Minimum Rating</h5>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setMinRating(minRating === star ? 0 : star)}
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-all border",
                              minRating >= star 
                                ? "bg-yellow-50 border-yellow-200 text-yellow-500" 
                                : "bg-gray-50 border-gray-100 text-gray-300"
                            )}
                          >
                            <Star size={18} fill={minRating >= star ? "currentColor" : "none"} />
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {minRating > 0 ? `${minRating} Stars & Up` : 'Any Rating'}
                      </p>
                    </div>

                    {/* Dietary Tags */}
                    <div className="space-y-4">
                      <h5 className="font-bold text-sm text-gray-900">Dietary & Tags</h5>
                      <div className="flex flex-wrap gap-2">
                        {allTags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => setSelectedTags(prev => 
                              prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                            )}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                              selectedTags.includes(tag)
                                ? "bg-red-900 text-white border-red-900"
                                : "bg-gray-50 text-gray-500 border-gray-100 hover:border-red-900 hover:text-red-900"
                            )}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-50 flex justify-end gap-3">
                    <button 
                      onClick={() => {
                        setPriceRange([0, 500]);
                        setMinRating(0);
                        setSelectedTags([]);
                      }}
                      className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-red-900 transition-colors"
                    >
                      Reset All
                    </button>
                    <button 
                      onClick={() => setIsFilterOpen(false)}
                      className="px-6 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all",
                  activeCategory === cat 
                    ? "bg-red-900 text-white shadow-lg shadow-red-900/20" 
                    : "bg-white text-gray-500 border border-gray-100 hover:border-red-900 hover:text-red-900"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Grid */}
        {filteredMenu.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredMenu.map((item) => (
                <motion.div 
                  layout
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all flex flex-col group"
                >
                  <div className="relative h-40 overflow-hidden">
                    <img 
                      src={item.image_url} 
                      alt={item.name} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 right-3 px-2 py-1 bg-white/90 backdrop-blur-md rounded-lg text-[10px] font-black text-gray-900 shadow-sm">
                      KES {item.price}
                    </div>
                    {item.rating && (
                      <div className="absolute top-3 left-3 px-2 py-1 bg-white/90 backdrop-blur-md rounded-lg text-[10px] font-black text-yellow-600 flex items-center gap-1 shadow-sm">
                        <Star size={10} fill="currentColor" />
                        {item.rating}
                      </div>
                    )}
                    {!item.is_available && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="px-3 py-1 bg-white text-gray-900 text-[10px] font-black uppercase rounded-full">
                          Sold Out
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold text-red-900 uppercase tracking-widest">{item.category}</p>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1 truncate">{item.name}</h4>
                    <p className="text-[10px] text-gray-400 line-clamp-2 mb-3 flex-1">{item.description}</p>
                    
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {item.tags.map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 bg-gray-50 text-gray-400 text-[8px] font-bold rounded uppercase tracking-tighter border border-gray-100">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {item.containers && item.containers.length > 0 ? (
                      <div className="space-y-2 mb-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select Container:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {item.containers.map((container) => (
                            <button
                              key={container.name}
                              onClick={() => handleOrder(item, container)}
                              disabled={!item.is_available}
                              className="flex flex-col items-center p-2 rounded-xl border border-gray-100 hover:border-red-900 hover:bg-red-50 transition-all group/btn"
                            >
                              {pickedItems[`${item.id}-${container.name}`] ? (
                                <span className="text-[10px] font-bold text-green-600">Picked</span>
                              ) : (
                                <span className="text-[10px] font-bold text-gray-600 group-hover/btn:text-red-900">{container.name}</span>
                              )}
                              <span className="text-xs font-black text-gray-900">KES {container.price}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleOrder(item)}
                        disabled={!item.is_available}
                        className={cn(
                          "w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all mb-4",
                          item.is_available 
                            ? (pickedItems[item.id] ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-900 hover:bg-red-900 hover:text-white")
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        )}
                      >
                        {pickedItems[item.id] ? (
                          <><Check size={14} /> Picked</>
                        ) : (
                          <><Plus size={14} /> Order (KES {item.price})</>
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
              <Search size={40} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">No results found</h3>
              <p className="text-sm text-gray-400 max-w-xs">We couldn't find any meals matching your current filters. Try adjusting your search or filters.</p>
            </div>
            <button 
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('All');
                setPriceRange([0, 500]);
                setMinRating(0);
                setSelectedTags([]);
              }}
              className="text-red-900 font-bold text-sm hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    );
  };

  const CustomerOrders = () => (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">Order History</h2>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-gray-100 text-xs font-bold text-gray-500">
          <Filter size={14} /> Filter
        </div>
      </div>

      <div className="space-y-4">
        {orders.length > 0 ? (
          orders.map((order) => (
            <motion.div 
              key={order.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                    order.status === 'COMPLETED' ? "bg-green-50 text-green-600" :
                    order.status === 'READY' ? "bg-blue-50 text-blue-600" :
                    order.status === 'PREPARING' ? "bg-orange-50 text-orange-600" :
                    "bg-gray-50 text-gray-400"
                  )}>
                    {order.status === 'COMPLETED' ? <CheckCircle2 size={24} /> :
                     order.status === 'READY' ? <Package size={24} /> :
                     order.status === 'PREPARING' ? <Clock size={24} /> :
                     <FileText size={24} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-900">Order #{order.id.slice(-6).toUpperCase()}</h4>
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider",
                        order.status === 'COMPLETED' ? "bg-green-100 text-green-700" :
                        order.status === 'READY' ? "bg-blue-100 text-blue-700" :
                        order.status === 'PREPARING' ? "bg-orange-100 text-orange-700" :
                        "bg-gray-100 text-gray-600"
                      )}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Amount</p>
                  <p className="text-xl font-black text-red-900">KES {order.total_amount}</p>
                </div>
              </div>

              {/* Visual Status Tracker */}
              <div className="mb-8 px-2">
                <div className="relative flex items-center justify-between">
                  {/* Progress Line */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-100 rounded-full z-0" />
                  <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-red-900 rounded-full z-0 transition-all duration-500" 
                    style={{ 
                      width: order.status === 'PENDING' ? '0%' : 
                             order.status === 'PREPARING' ? '33%' : 
                             order.status === 'READY' ? '66%' : '100%' 
                    }} 
                  />

                  {/* Steps */}
                  {[
                    { id: 'PENDING', label: 'Pending', icon: FileText },
                    { id: 'PREPARING', label: 'Preparing', icon: Clock },
                    { id: 'READY', label: 'Ready', icon: Package },
                    { id: 'COMPLETED', label: 'Done', icon: CheckCircle2 },
                  ].map((step, index) => {
                    const statusOrder = ['PENDING', 'PREPARING', 'READY', 'COMPLETED'];
                    const currentIndex = statusOrder.indexOf(order.status);
                    const isActive = index <= currentIndex;
                    const isCurrent = index === currentIndex;

                    return (
                      <div key={step.id} className="relative z-10 flex flex-col items-center">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-4 border-white shadow-sm",
                          isActive ? "bg-red-900 text-white" : "bg-gray-200 text-gray-400",
                          isCurrent && "ring-4 ring-red-900/20 scale-110"
                        )}>
                          <step.icon size={14} />
                        </div>
                        <span className={cn(
                          "absolute -bottom-6 whitespace-nowrap text-[10px] font-bold uppercase tracking-tighter transition-colors",
                          isActive ? "text-red-900" : "text-gray-400"
                        )}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-[10px] font-bold text-gray-500 border border-gray-100">
                        {item.quantity}x
                      </span>
                      <span className="font-medium text-gray-700">
                        {item.name} {item.container && <span className="text-[10px] text-gray-400">({item.container})</span>}
                      </span>
                    </div>
                    <span className="font-bold text-gray-900">KES {item.price * item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-50">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    order.payment_status === 'SUCCESS' ? "bg-green-500" : "bg-orange-500"
                  )} />
                  <span className="text-xs font-bold text-gray-500">
                    Payment: {order.payment_status}
                  </span>
                </div>
                <button className="text-xs font-bold text-red-900 hover:underline">
                  Need Help?
                </button>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-300">
              <History size={40} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900">No orders yet</h3>
              <p className="text-sm text-gray-400">Your order history will appear here once you make a purchase.</p>
            </div>
            <button 
              onClick={() => setActiveTab('menu')}
              className="px-6 py-3 bg-red-900 text-white rounded-2xl font-bold shadow-lg shadow-red-900/20"
            >
              Start Ordering
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const VendorPortal = () => {
    const [newItem, setNewItem] = useState<Partial<MenuItem>>({
      name: '',
      description: '',
      price: 0,
      category: 'Main Staples',
      is_available: true,
      image_url: 'https://picsum.photos/seed/food/400/300',
      containers: []
    });
    const [containerInput, setContainerInput] = useState({ name: '', price: '' });

    const handleAddItem = async () => {
      if (!newItem.name || !newItem.price) return;
      try {
        const supabase = requireSupabase();
        await supabase
          .from('menu')
          .insert({ ...(newItem as any), is_available: true });
        setNewItem({
          name: '',
          description: '',
          price: 0,
          category: 'Main Staples',
          is_available: true,
          image_url: 'https://picsum.photos/seed/food/400/300',
          containers: []
        });
        setContainerInput({ name: '', price: '' });
      } catch (error) {
        console.error("Add Item Error:", error);
      }
    };

    const addContainerToNewItem = () => {
      if (!containerInput.name || !containerInput.price) return;
      setNewItem(prev => ({
        ...prev,
        containers: [...(prev.containers || []), { name: containerInput.name, price: Number(containerInput.price) }]
      }));
      setContainerInput({ name: '', price: '' });
    };

    const removeContainerFromNewItem = (index: number) => {
      setNewItem(prev => ({
        ...prev,
        containers: prev.containers?.filter((_, i) => i !== index)
      }));
    };

    const toggleAvailability = async (id: string, current: boolean) => {
      try {
        const supabase = requireSupabase();
        await supabase.from('menu').update({ is_available: !current }).eq('id', id);
      } catch (error) {
        console.error("Toggle Error:", error);
      }
    };

    const deleteItem = async (id: string) => {
      if (!confirm("Are you sure you want to delete this item?")) return;
      try {
        const supabase = requireSupabase();
        await supabase.from('menu').delete().eq('id', id);
      } catch (error) {
        console.error("Delete Error:", error);
      }
    };

    const pendingOrders = orders.filter(o => o.status !== 'COMPLETED');
    const revenue = orders
      .filter(o => o.payment_status === 'SUCCESS')
      .reduce((sum, o) => sum + o.total_amount, 0);

    return (
      <div className="space-y-10 pb-20">
        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
            <TrendingUp className="absolute -right-4 -bottom-4 w-32 h-32 text-white/5" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Total Revenue</p>
            <h3 className="text-4xl font-black mb-4">KES {revenue.toLocaleString()}</h3>
            <div className="flex items-center gap-2 text-green-400 text-xs font-bold">
              <ArrowUp size={14} /> +12.5% from last week
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col justify-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Active Orders</p>
            <h3 className="text-4xl font-black text-gray-900 mb-4">{pendingOrders.length}</h3>
            <div className="flex items-center gap-2 text-orange-500 text-xs font-bold">
              <Clock size={14} /> {orders.filter(o => o.status === 'PREPARING').length} in preparation
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col justify-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Menu Items</p>
            <h3 className="text-4xl font-black text-gray-900 mb-4">{menu.length}</h3>
            <div className="flex items-center gap-2 text-blue-500 text-xs font-bold">
              <Utensils size={14} /> {menu.filter(m => m.is_available).length} currently available
            </div>
          </div>
        </div>

        {/* Live Orders */}
        <section id="vendor-orders" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-gray-900">Live Orders</h3>
            <div className="px-4 py-2 bg-red-50 text-red-900 rounded-xl text-xs font-bold animate-pulse">
              Real-time Updates Active
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pendingOrders.length > 0 ? (
              pendingOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h4 className="font-bold text-gray-900">Order #{order.id.slice(-6).toUpperCase()}</h4>
                      <p className="text-xs text-gray-400">{order.full_name} • {order.phone_number}</p>
                    </div>
                    <select 
                      value={order.status}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value as any)}
                      className={cn(
                        "px-3 py-2 rounded-xl text-xs font-bold outline-none border-none shadow-sm",
                        order.status === 'READY' ? "bg-blue-900 text-white" :
                        order.status === 'PREPARING' ? "bg-orange-500 text-white" :
                        "bg-gray-100 text-gray-600"
                      )}
                    >
                      <option value="PENDING">Pending</option>
                      <option value="PREPARING">Preparing</option>
                      <option value="READY">Ready for Pickup</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>

                  <div className="space-y-2 mb-6">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-600 font-medium">
                          {item.quantity}x {item.name} {item.container && <span className="text-[10px] text-gray-400">({item.container})</span>}
                        </span>
                        <span className="font-bold text-gray-900">KES {item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        order.payment_status === 'SUCCESS' ? "bg-green-500" : "bg-orange-500"
                      )} />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Payment: {order.payment_status}
                      </span>
                    </div>
                    <p className="font-black text-gray-900">Total: KES {order.total_amount}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="lg:col-span-2 py-10 bg-gray-50 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                <Package className="text-gray-300 mb-2" size={32} />
                <p className="text-sm font-bold text-gray-400">No active orders at the moment</p>
              </div>
            )}
          </div>
        </section>

        {/* Menu Editor */}
        <section id="vendor-menu" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-gray-900">Menu Management</h3>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Add New Item Form */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm h-fit space-y-6">
              <h4 className="font-bold text-lg flex items-center gap-2">
                <Plus className="text-red-900" size={20} /> Add New Item
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Item Name</label>
                  <input 
                    type="text" 
                    value={newItem.name}
                    onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                    placeholder="e.g., Beef Stew"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-red-900/10 focus:border-red-900 transition-all text-sm font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Default Price (KES)</label>
                    <input 
                      type="number" 
                      value={newItem.price || ''}
                      onChange={(e) => setNewItem({...newItem, price: Number(e.target.value)})}
                      placeholder="120"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-red-900/10 focus:border-red-900 transition-all text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Category</label>
                    <select 
                      value={newItem.category}
                      onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-red-900/10 focus:border-red-900 transition-all text-sm font-bold"
                    >
                      {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Description</label>
                  <textarea 
                    value={newItem.description}
                    onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                    placeholder="Brief description of the meal..."
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-red-900/10 focus:border-red-900 transition-all text-sm font-medium resize-none"
                  />
                </div>

                {/* Container Options Editor */}
                <div className="space-y-3 pt-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Container Options (Optional)</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={containerInput.name}
                      onChange={(e) => setContainerInput({...containerInput, name: e.target.value})}
                      placeholder="e.g., Takeaway"
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs outline-none"
                    />
                    <input 
                      type="number" 
                      value={containerInput.price}
                      onChange={(e) => setContainerInput({...containerInput, price: e.target.value})}
                      placeholder="Price"
                      className="w-20 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs outline-none"
                    />
                    <button 
                      onClick={addContainerToNewItem}
                      className="p-2 bg-gray-900 text-white rounded-lg hover:bg-red-900 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {newItem.containers?.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1 bg-red-50 text-red-900 rounded-md text-[10px] font-bold">
                        <span>{c.name}: {c.price}</span>
                        <button onClick={() => removeContainerFromNewItem(i)} className="hover:text-red-600">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleAddItem}
                  className="w-full py-4 bg-red-900 text-white rounded-2xl font-bold shadow-lg shadow-red-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Save Menu Item
                </button>
              </div>
            </div>

            {/* Menu List */}
            <div className="xl:col-span-2 space-y-4">
              {menu.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4 group">
                  <img 
                    src={item.image_url} 
                    alt={item.name} 
                    className="w-20 h-20 rounded-2xl object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-900 truncate">{item.name}</h4>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-md uppercase tracking-wider">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-1 mb-2">{item.description}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-black text-red-900">KES {item.price}</span>
                      {item.containers?.map((c, i) => (
                        <span key={i} className="text-[10px] font-bold text-gray-400 border border-gray-100 px-1.5 py-0.5 rounded">
                          {c.name}: {c.price}
                        </span>
                      ))}
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => toggleAvailability(item.id, item.is_available)}
                          className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                            item.is_available ? "bg-green-500" : "bg-gray-300"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                              item.is_available ? "translate-x-5" : "translate-x-1"
                            )}
                          />
                        </button>
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          item.is_available ? "text-green-600" : "text-gray-400"
                        )}>
                          {item.is_available ? 'Available' : 'Sold Out'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                      <Edit3 size={18} />
                    </button>
                    <button 
                      onClick={() => deleteItem(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20 lg:pb-0 lg:pl-64">
      {Navbar()}
      {Sidebar()}
      
      <main className="max-w-7xl mx-auto px-4 lg:px-10 py-6 lg:py-10">
        {/* Breadcrumbs / Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
            <span className="hover:text-red-900 cursor-pointer" onClick={() => setActiveTab('home')}>Home</span>
            <ChevronRight size={12} />
            <span className="text-gray-900">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</span>
          </div>
          <div className="hidden lg:flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Live Status</span>
            </div>
            <button 
              onClick={() => setIsCartOpen(true)}
              className="px-6 py-2.5 bg-red-900 text-white rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-red-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <ShoppingCart size={18} />
              Cart ({cartCount})
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={view + activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {view === 'customer' ? (
              <>
                {activeTab === 'home' && CustomerHome()}
                {activeTab === 'menu' && CustomerMenu()}
                {activeTab === 'orders' && CustomerOrders()}
                {activeTab === 'profile' && (
                  <div className="max-w-2xl mx-auto py-10 space-y-8">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-24 h-24 bg-red-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-red-900/20">
                        <UserIcon size={48} />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-2xl font-black text-gray-900">{user?.full_name}</h2>
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center justify-center gap-2">
                            <Smartphone size={14} className="text-gray-400" />
                            <input 
                              type="tel"
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                              className="bg-transparent border-none p-0 text-gray-400 font-medium text-center focus:ring-0 w-32"
                              placeholder="2547XXXXXXXX"
                            />
                          </div>
                          {phoneNumber !== user?.phone_number && (
                            <button 
                              onClick={() => setUser(prev => prev ? { ...prev, phone_number: phoneNumber } : null)}
                              className="text-[10px] font-bold text-red-900 uppercase tracking-widest hover:underline"
                            >
                              Save Changes
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      {[
                        { label: 'Edit Profile', icon: Edit3 },
                        { label: 'Payment Methods', icon: CreditCard },
                        { label: 'Notification Settings', icon: Settings },
                        { label: 'Help & Support', icon: AlertCircle },
                        { label: 'Logout', icon: LogOut, danger: true },
                      ].map((item, i) => (
                        <button 
                          key={i}
                          className={cn(
                            "w-full flex items-center justify-between p-5 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group",
                            item.danger ? "text-red-600" : "text-gray-700"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center",
                              item.danger ? "bg-red-50" : "bg-gray-50 text-gray-400 group-hover:text-red-900"
                            )}>
                              <item.icon size={20} />
                            </div>
                            <span className="font-bold">{item.label}</span>
                          </div>
                          <ChevronRight size={18} className="text-gray-300" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              VendorPortal()
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {BottomNav()}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-900">
                    <ShoppingCart size={20} />
                  </div>
                  <div>
                    <h2 className="font-bold text-xl">Your Cart</h2>
                    <p className="text-xs text-gray-400">{cartCount} items selected</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                      <ShoppingCart size={40} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Your cart is empty</h3>
                      <p className="text-sm text-gray-400 max-w-[200px]">Looks like you haven't added anything to your cart yet.</p>
                    </div>
                    <button 
                      onClick={() => { setIsCartOpen(false); setActiveTab('menu'); }}
                      className="px-6 py-3 bg-red-900 text-white rounded-2xl font-bold shadow-lg shadow-red-900/20"
                    >
                      Browse Menu
                    </button>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="flex gap-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                      <img 
                        src={item.image_url} 
                        alt={item.name} 
                        className="w-20 h-20 rounded-xl object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 truncate">{item.name}</h4>
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-xs text-gray-400">KES {item.price}</p>
                          {item.selectedContainer && (
                            <span className="text-[10px] font-bold text-red-900 bg-red-50 px-1.5 py-0.5 rounded">
                              {item.selectedContainer.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-1">
                            <button 
                              onClick={() => removeFromCart(item.id, item.selectedContainer?.name)}
                              className="p-1 hover:bg-gray-50 rounded text-gray-500"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                            <button 
                              onClick={() => addToCart(item, item.selectedContainer)}
                              className="p-1 hover:bg-gray-50 rounded text-red-900"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <p className="font-bold text-red-900">KES {item.price * item.quantity}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-6 bg-white border-t border-gray-100 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Subtotal</span>
                      <span>KES {cartTotal}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Service Fee</span>
                      <span>KES 0</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-50">
                      <span>Total</span>
                      <span>KES {cartTotal}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Payment Details</h4>
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded-lg text-[10px] font-bold text-green-600 border border-green-100">
                        <Smartphone size={10} /> M-Pesa STK
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="mpesa-phone" className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
                        M-Pesa Phone Number
                      </label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                          <Smartphone size={18} />
                        </div>
                        <input 
                          id="mpesa-phone"
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                          placeholder="e.g. 254712345678"
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-red-900/20 focus:border-red-900 outline-none transition-all placeholder:text-gray-300"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 px-1 italic">
                        This number will receive the M-Pesa STK push prompt for payment.
                      </p>
                    </div>
                  </div>

                  {checkoutError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs font-medium animate-in fade-in slide-in-from-top-2">
                      <AlertCircle size={16} />
                      <span>{checkoutError}</span>
                    </div>
                  )}

                  <button 
                    onClick={handleCheckout}
                    disabled={isCheckoutLoading}
                    className={cn(
                      "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl",
                      checkoutStatus === 'success' ? "bg-green-600 text-white" : 
                      checkoutStatus === 'error' ? "bg-red-600 text-white" :
                      "bg-red-900 text-white shadow-red-900/20 hover:scale-[1.02] active:scale-[0.98]"
                    )}
                  >
                    {isCheckoutLoading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : checkoutStatus === 'success' ? (
                      <><CheckCircle2 size={20} /> Payment Sent!</>
                    ) : checkoutStatus === 'error' ? (
                      <><AlertCircle size={20} /> Try Again</>
                    ) : (
                      <>Pay KES {cartTotal}</>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-gray-400">
                    By clicking pay, you will receive an M-Pesa prompt on your phone.
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Scroll to Top */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-24 right-6 lg:bottom-10 lg:right-10 w-12 h-12 bg-white text-red-900 rounded-2xl shadow-2xl border border-gray-100 flex items-center justify-center z-50 hover:bg-red-900 hover:text-white transition-all"
          >
            <ArrowUp size={24} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
