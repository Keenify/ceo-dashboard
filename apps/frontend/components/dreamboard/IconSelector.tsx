import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { 
  FaHeart, 
  FaStar, 
  FaSmile, 
  FaLightbulb, 
  FaRocket,
  FaCrown,
  FaGem,
  FaFire,
  FaLeaf,
  FaMoon,
  FaCamera,
  FaMusic,
  FaGamepad,
  FaGift,
  FaPlane,
  FaCar,
  FaHome,
  FaUser,
  FaEnvelope,
  FaPhone,
  FaShoppingCart,
  FaCalendar,
  FaClipboard,
  FaLock,
  FaKey,
  FaWifi,
  FaBell,
  FaSearch,
  FaDownload,
  FaUpload,
  FaPlay,
  FaPause,
  FaStop,
  FaVolumeUp,
  FaCoffee,
  FaBirthdayCake,
  FaAppleAlt,
  FaBook,
  FaPen,
  FaEdit,
  FaTrash,
  FaSave,
  FaCopy,
  FaShare,
  FaEye,
  FaEyeSlash,
  FaThumbsUp,
  FaThumbsDown,
  FaMoneyBill,
  FaCreditCard,
  FaGlobe,
  FaMapMarkerAlt,
  FaCompass,
  FaCloud,
  FaSun,
  FaSnowflake,
  FaUmbrella,
  FaTree,
  FaBug,
  FaDog,
  FaCat,
  FaArrowUp,
  FaArrowDown,
  FaArrowLeft,
  FaArrowRight,
  FaArrowCircleUp,
  FaArrowCircleDown,
  FaArrowCircleLeft,
  FaArrowCircleRight,
  FaChevronUp,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaAngleUp,
  FaAngleDown,
  FaAngleLeft,
  FaAngleRight,
  FaCaretUp,
  FaCaretDown,
  FaCaretLeft,
  FaCaretRight,
  FaMinus,
  FaPlus,
  FaTimes,
  FaLongArrowAltUp,
  FaLongArrowAltDown,
  FaLongArrowAltLeft,
  FaLongArrowAltRight
} from 'react-icons/fa';
import { 
  HiSparkles, 
  HiSun, 
  HiHeart, 
  HiStar,
  HiLightBulb,
  HiMoon,
  HiCloud,
  HiLightningBolt,
  HiLocationMarker,
  HiGlobeAlt,
  HiCamera,
  HiMusicNote,
  HiChat,
  HiMail,
  HiPhone,
  HiCalendar,
  HiClock,
  HiUser,
  HiUsers,
  HiHome,
  HiOfficeBuilding,
  HiShoppingCart,
  HiGift,
  HiAcademicCap,
  HiBookOpen,
  HiColorSwatch,
  HiPhotograph,
  HiFilm,
  HiVolumeUp,
  HiWifi,
  HiBell,
  HiSearch,
  HiDownload,
  HiUpload,
  HiPlay,
  HiPause,
  HiStop,
  HiArrowUp,
  HiArrowDown,
  HiArrowLeft,
  HiArrowRight,
  HiArrowNarrowUp,
  HiArrowNarrowDown,
  HiArrowNarrowLeft,
  HiArrowNarrowRight,
  HiChevronUp,
  HiChevronDown,
  HiChevronLeft,
  HiChevronRight,
  HiChevronDoubleUp,
  HiChevronDoubleDown,
  HiChevronDoubleLeft,
  HiChevronDoubleRight,
  HiTrendingUp,
  HiTrendingDown,
  HiSwitchHorizontal,
  HiSwitchVertical
} from 'react-icons/hi';
import { 
  Star,
  Heart,
  Smile,
  Lightbulb,
  Rocket,
  Crown,
  Gem,
  Flame,
  Leaf,
  Moon,
  Sun,
  Cloud,
  Zap,
  MapPin,
  Globe,
  Camera,
  Music,
  MessageCircle,
  Mail,
  Phone,
  Calendar,
  Clock,
  User,
  Users,
  Home,
  Building,
  Car,
  Plane,
  Gift,
  Gamepad2,
  ShoppingCart,
  Search,
  Download,
  Upload,
  Play,
  Pause,
  Square,
  Volume2,
  Wifi,
  Bell,
  Lock,
  Key,
  Settings,
  Trash2,
  Edit,
  Save,
  Copy,
  Share,
  Eye,
  EyeOff,
  ThumbsUp,
  ThumbsDown,
  Coffee,
  Pizza,
  Cake,
  Apple,
  Book,
  PenTool,
  Palette,
  Image,
  Video,
  FileText,
  Folder,
  Monitor,
  Smartphone,
  Laptop,
  Headphones,
  Speaker,
  Printer,
  Mouse,
  Keyboard,
  Tv,
  Radio,
  Target,
  Trophy,
  Award,
  Medal,
  Flag,
  Bookmark,
  Tag,
  Hash,
  AtSign,
  DollarSign,
  Percent,
  Calculator,
  CreditCard,
  Banknote,
  Coins,
  Wallet,
  ShoppingBag,
  Store,
  Truck,
  Package,
  Box,
  Archive,
  Inbox,
  Send,
  Reply,
  Forward,
  Paperclip,
  Link,
  Unlink,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  RefreshCw,
  Power,
  Plug,
  Battery,
  Signal,
  Bluetooth,
  Rss,
  Compass,
  Navigation,
  Map,
  Route,
  Anchor,
  Umbrella,
  Thermometer,
  Snowflake,
  Droplets,
  Wind,
  Trees,
  Mountain,
  Fish,
  Bird,
  Flower,
  Flower2,
  Sprout,
  TreePine,
  Bug,
  Shield,
  ShieldCheck,
  Briefcase,
  GraduationCap,
  Stethoscope,
  Pill,
  Activity,
  Dumbbell,
  Bike,
  Train,
  Bus,
  Ship,
  Utensils,
  ChefHat,
  Wine,
  GlassWater,
  IceCream,
  Sandwich,
  Croissant,
  Donut,
  Popcorn,
  Candy,
  Lollipop,
  Cherry,
  Banana,
  Grape,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUpLeft,
  ArrowDownLeft,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUp,
  ChevronsDown,
  ChevronsLeft,
  ChevronsRight,
  TrendingUp,
  TrendingDown,
  Move,
  MoveHorizontal,
  MoveVertical,
  MoveDiagonal,
  CornerUpLeft,
  CornerUpRight,
  CornerDownLeft,
  CornerDownRight,
  Minus,
  Plus,
  X,
  Check,
  MoreHorizontal,
  MoreVertical,
  Repeat,
  ArrowBigUp,
  ArrowBigDown,
  ArrowBigLeft,
  ArrowBigRight
} from 'lucide-react';
import { Database } from "@/lib/database.types";
import { iconToSvgClient, svgToDataUrl } from "@/app/dreamboard/utils/iconToSvg";

interface IconSelectorProps {
  onIconSelect: (iconSvg: string, iconName: string) => void;
  onItemCreate: (item: Database["public"]["Tables"]["dreamboard_items"]["Insert"]) => void;
  userId: string;
  isOpen?: boolean;
  onClose?: () => void;
}

const ICON_COLLECTIONS = {
  'Popular': [
    { icon: Heart, name: 'heart', color: '#e74c3c' },
    { icon: Star, name: 'star', color: '#f1c40f' },
    { icon: Smile, name: 'smile', color: '#f39c12' },
    { icon: Lightbulb, name: 'lightbulb', color: '#f1c40f' },
    { icon: Rocket, name: 'rocket', color: '#3498db' },
    { icon: Camera, name: 'camera', color: '#34495e' },
    { icon: Music, name: 'music', color: '#9b59b6' },
    { icon: Gift, name: 'gift', color: '#e74c3c' },
    { icon: Trophy, name: 'trophy', color: '#f1c40f' },
    { icon: Home, name: 'home', color: '#34495e' },
    { icon: Users, name: 'users', color: '#3498db' },
    { icon: Search, name: 'search', color: '#7f8c8d' },
    { icon: Bell, name: 'bell', color: '#e67e22' },
    { icon: Calendar, name: 'calendar', color: '#e74c3c' },
    { icon: Clock, name: 'clock', color: '#f39c12' },
  ],
  'Communication': [
    { icon: Mail, name: 'mail', color: '#3498db' },
    { icon: Phone, name: 'phone', color: '#27ae60' },
    { icon: MessageCircle, name: 'message', color: '#9b59b6' },
    { icon: User, name: 'user', color: '#34495e' },
    { icon: Users, name: 'users', color: '#3498db' },
    { icon: AtSign, name: 'at-sign', color: '#9b59b6' },
    { icon: Share, name: 'share', color: '#1abc9c' },
    { icon: Send, name: 'send', color: '#3498db' },
    { icon: Reply, name: 'reply', color: '#27ae60' },
    { icon: Forward, name: 'forward', color: '#e74c3c' },
    { icon: HiChat, name: 'chat-hi', color: '#8e44ad' },
    { icon: HiMail, name: 'mail-hi', color: '#2980b9' },
    { icon: Paperclip, name: 'paperclip', color: '#7f8c8d' },
    { icon: Link, name: 'link', color: '#3498db' },
  ],
  'Business': [
    { icon: Briefcase, name: 'briefcase', color: '#2c3e50' },
    { icon: Building, name: 'building', color: '#7f8c8d' },
    { icon: Calculator, name: 'calculator', color: '#34495e' },
    { icon: CreditCard, name: 'credit-card', color: '#27ae60' },
    { icon: DollarSign, name: 'dollar-sign', color: '#27ae60' },
    { icon: Banknote, name: 'banknote', color: '#2ecc71' },
    { icon: Coins, name: 'coins', color: '#f39c12' },
    { icon: Wallet, name: 'wallet', color: '#8b4513' },
    { icon: ShoppingCart, name: 'shopping-cart', color: '#e67e22' },
    { icon: Store, name: 'store', color: '#34495e' },
    { icon: Package, name: 'package', color: '#d35400' },
    { icon: Truck, name: 'truck', color: '#e74c3c' },
    { icon: FileText, name: 'file-text', color: '#3498db' },
    { icon: Folder, name: 'folder', color: '#f1c40f' },
    { icon: Archive, name: 'archive', color: '#95a5a6' },
  ],
  'Technology': [
    { icon: Monitor, name: 'monitor', color: '#34495e' },
    { icon: Smartphone, name: 'smartphone', color: '#2c3e50' },
    { icon: Laptop, name: 'laptop', color: '#7f8c8d' },
    { icon: Headphones, name: 'headphones', color: '#9b59b6' },
    { icon: Wifi, name: 'wifi', color: '#3498db' },
    { icon: Bluetooth, name: 'bluetooth', color: '#3498db' },
    { icon: Battery, name: 'battery', color: '#27ae60' },
    { icon: Plug, name: 'plug', color: '#e74c3c' },
    { icon: Settings, name: 'settings', color: '#7f8c8d' },
    { icon: Power, name: 'power', color: '#e74c3c' },
    { icon: Signal, name: 'signal', color: '#27ae60' },
    { icon: Printer, name: 'printer', color: '#2c3e50' },
    { icon: Mouse, name: 'mouse', color: '#7f8c8d' },
    { icon: Keyboard, name: 'keyboard', color: '#34495e' },
    { icon: Radio, name: 'radio', color: '#e67e22' },
  ],
  'Media': [
    { icon: Image, name: 'image', color: '#3498db' },
    { icon: Video, name: 'video', color: '#e74c3c' },
    { icon: Music, name: 'music-lucide', color: '#9b59b6' },
    { icon: Volume2, name: 'volume', color: '#27ae60' },
    { icon: Play, name: 'play', color: '#27ae60' },
    { icon: Pause, name: 'pause', color: '#f39c12' },
    { icon: Square, name: 'stop', color: '#e74c3c' },
    { icon: Camera, name: 'camera-lucide', color: '#34495e' },
    { icon: Tv, name: 'tv', color: '#2c3e50' },
    { icon: Speaker, name: 'speaker', color: '#8e44ad' },
    { icon: Download, name: 'download', color: '#27ae60' },
    { icon: Upload, name: 'upload', color: '#3498db' },
    { icon: HiPhotograph, name: 'photograph', color: '#e67e22' },
    { icon: HiFilm, name: 'film', color: '#34495e' },
    { icon: HiMusicNote, name: 'music-note', color: '#8e44ad' },
  ],
  'Nature': [
    { icon: Leaf, name: 'leaf', color: '#27ae60' },
    { icon: Trees, name: 'trees', color: '#2ecc71' },
    { icon: TreePine, name: 'tree-pine', color: '#196f3d' },
    { icon: Flower, name: 'flower', color: '#e91e63' },
    { icon: Flower2, name: 'flower2', color: '#ff69b4' },
    { icon: Sprout, name: 'sprout', color: '#8bc34a' },
    { icon: Mountain, name: 'mountain', color: '#8d6e63' },
    { icon: Fish, name: 'fish', color: '#00bcd4' },
    { icon: Bird, name: 'bird', color: '#ff9800' },
    { icon: Bug, name: 'bug', color: '#4caf50' },
    { icon: FaTree, name: 'tree-fa', color: '#27ae60' },
    { icon: FaBug, name: 'bug-fa', color: '#8bc34a' },
  ],
  'Weather': [
    { icon: Sun, name: 'sun', color: '#f1c40f' },
    { icon: Moon, name: 'moon', color: '#2c3e50' },
    { icon: Cloud, name: 'cloud', color: '#bdc3c7' },
    { icon: Droplets, name: 'droplets', color: '#3498db' },
    { icon: Snowflake, name: 'snowflake', color: '#ecf0f1' },
    { icon: Wind, name: 'wind', color: '#7fb3d3' },
    { icon: Zap, name: 'lightning', color: '#f1c40f' },
    { icon: Thermometer, name: 'thermometer', color: '#e74c3c' },
    { icon: Umbrella, name: 'umbrella', color: '#8e44ad' },
    { icon: HiSun, name: 'sun-hi', color: '#f39c12' },
    { icon: HiCloud, name: 'cloud-hi', color: '#95a5a6' },
    { icon: FaSnowflake, name: 'snowflake-fa', color: '#85c1e9' },
    { icon: FaUmbrella, name: 'umbrella-fa', color: '#9b59b6' },
    { icon: Compass, name: 'compass', color: '#e67e22' },
    { icon: MapPin, name: 'map-pin', color: '#e74c3c' },
  ],
  'Food': [
    { icon: Coffee, name: 'coffee', color: '#8b4513' },
    { icon: Pizza, name: 'pizza', color: '#ff6b6b' },
    { icon: Cake, name: 'cake', color: '#ff69b4' },
    { icon: Apple, name: 'apple', color: '#e74c3c' },
    { icon: Utensils, name: 'utensils', color: '#7f8c8d' },
    { icon: ChefHat, name: 'chef-hat', color: '#ecf0f1' },
    { icon: Wine, name: 'wine', color: '#8e44ad' },
    { icon: GlassWater, name: 'glass-water', color: '#3498db' },
    { icon: IceCream, name: 'ice-cream', color: '#ffb3ba' },
    { icon: Cherry, name: 'cherry', color: '#dc143c' },
    { icon: Banana, name: 'banana', color: '#ffd700' },
    { icon: Grape, name: 'grape', color: '#8a2be2' },
    { icon: FaCoffee, name: 'coffee-fa', color: '#6f4e37' },
  ],
  'Activities': [
    { icon: Gamepad2, name: 'gamepad', color: '#e67e22' },
    { icon: Book, name: 'book', color: '#8b4513' },
    { icon: PenTool, name: 'pen-tool', color: '#2c3e50' },
    { icon: Palette, name: 'palette', color: '#e91e63' },
    { icon: Target, name: 'target', color: '#e74c3c' },
    { icon: Award, name: 'award', color: '#f1c40f' },
    { icon: Medal, name: 'medal', color: '#f39c12' },
    { icon: Flag, name: 'flag', color: '#e74c3c' },
    { icon: Bookmark, name: 'bookmark', color: '#3498db' },
    { icon: GraduationCap, name: 'graduation-cap', color: '#2c3e50' },
    { icon: Dumbbell, name: 'dumbbell', color: '#34495e' },
    { icon: Activity, name: 'activity', color: '#e74c3c' },
    { icon: Bike, name: 'bike', color: '#27ae60' },
    { icon: HiAcademicCap, name: 'academic-cap', color: '#3498db' },
    { icon: HiBookOpen, name: 'book-open', color: '#d35400' },
  ],
  'Transportation': [
    { icon: Car, name: 'car', color: '#3498db' },
    { icon: Plane, name: 'plane', color: '#2980b9' },
    { icon: Train, name: 'train', color: '#27ae60' },
    { icon: Bus, name: 'bus', color: '#f39c12' },
    { icon: Ship, name: 'ship', color: '#16a085' },
    { icon: Bike, name: 'bicycle', color: '#2ecc71' },
    { icon: Truck, name: 'truck-transport', color: '#e67e22' },
    { icon: Anchor, name: 'anchor', color: '#34495e' },
    { icon: Route, name: 'route', color: '#9b59b6' },
    { icon: Map, name: 'map', color: '#e74c3c' },
    { icon: Navigation, name: 'navigation', color: '#3498db' },
    { icon: FaCar, name: 'car-fa', color: '#2c3e50' },
    { icon: FaPlane, name: 'plane-fa', color: '#3498db' },
    { icon: Compass, name: 'compass-transport', color: '#d35400' },
    { icon: Globe, name: 'globe', color: '#16a085' },
  ],
  'Arrows & Lines': [
    // Basic Arrows (Lucide)
    { icon: ArrowUp, name: 'arrow-up', color: '#2c3e50' },
    { icon: ArrowDown, name: 'arrow-down', color: '#2c3e50' },
    { icon: ArrowLeft, name: 'arrow-left', color: '#2c3e50' },
    { icon: ArrowRight, name: 'arrow-right', color: '#2c3e50' },
    
    // Diagonal Arrows (Lucide)
    { icon: ArrowUpRight, name: 'arrow-up-right', color: '#3498db' },
    { icon: ArrowDownRight, name: 'arrow-down-right', color: '#3498db' },
    { icon: ArrowUpLeft, name: 'arrow-up-left', color: '#3498db' },
    { icon: ArrowDownLeft, name: 'arrow-down-left', color: '#3498db' },
    
    // FontAwesome Arrows
    { icon: FaArrowUp, name: 'fa-arrow-up', color: '#34495e' },
    { icon: FaArrowDown, name: 'fa-arrow-down', color: '#34495e' },
    { icon: FaArrowLeft, name: 'fa-arrow-left', color: '#34495e' },
    { icon: FaArrowRight, name: 'fa-arrow-right', color: '#34495e' },
    
    // Circle Arrows (FontAwesome)
    { icon: FaArrowCircleUp, name: 'fa-arrow-circle-up', color: '#27ae60' },
    { icon: FaArrowCircleDown, name: 'fa-arrow-circle-down', color: '#27ae60' },
    { icon: FaArrowCircleLeft, name: 'fa-arrow-circle-left', color: '#27ae60' },
    { icon: FaArrowCircleRight, name: 'fa-arrow-circle-right', color: '#27ae60' },
    
    // Long Arrows (FontAwesome)
    { icon: FaLongArrowAltUp, name: 'fa-long-arrow-up', color: '#9b59b6' },
    { icon: FaLongArrowAltDown, name: 'fa-long-arrow-down', color: '#9b59b6' },
    { icon: FaLongArrowAltLeft, name: 'fa-long-arrow-left', color: '#9b59b6' },
    { icon: FaLongArrowAltRight, name: 'fa-long-arrow-right', color: '#9b59b6' },
    
    // Chevrons (Lucide)
    { icon: ChevronUp, name: 'chevron-up', color: '#7f8c8d' },
    { icon: ChevronDown, name: 'chevron-down', color: '#7f8c8d' },
    { icon: ChevronLeft, name: 'chevron-left', color: '#7f8c8d' },
    { icon: ChevronRight, name: 'chevron-right', color: '#7f8c8d' },
    
    // Double Chevrons (Lucide)
    { icon: ChevronsUp, name: 'chevrons-up', color: '#e74c3c' },
    { icon: ChevronsDown, name: 'chevrons-down', color: '#e74c3c' },
    { icon: ChevronsLeft, name: 'chevrons-left', color: '#e74c3c' },
    { icon: ChevronsRight, name: 'chevrons-right', color: '#e74c3c' },
    
    // HeroIcons Arrows
    { icon: HiArrowUp, name: 'hi-arrow-up', color: '#f39c12' },
    { icon: HiArrowDown, name: 'hi-arrow-down', color: '#f39c12' },
    { icon: HiArrowLeft, name: 'hi-arrow-left', color: '#f39c12' },
    { icon: HiArrowRight, name: 'hi-arrow-right', color: '#f39c12' },
    
    // Trending (HeroIcons & Lucide)
    { icon: TrendingUp, name: 'trending-up', color: '#27ae60' },
    { icon: TrendingDown, name: 'trending-down', color: '#e74c3c' },
    { icon: HiTrendingUp, name: 'hi-trending-up', color: '#2ecc71' },
    { icon: HiTrendingDown, name: 'hi-trending-down', color: '#c0392b' },
    
    // Lines & Shapes
    { icon: Minus, name: 'line-horizontal', color: '#34495e' },
    { icon: Plus, name: 'plus', color: '#27ae60' },
    { icon: X, name: 'x', color: '#e74c3c' },
    { icon: Check, name: 'check', color: '#27ae60' },
    
    // Movement & Rotation
    { icon: Move, name: 'move', color: '#9b59b6' },
    { icon: RotateCw, name: 'rotate-right', color: '#f39c12' },
    { icon: RotateCcw, name: 'rotate-left', color: '#f39c12' },
    { icon: Repeat, name: 'repeat', color: '#3498db' },
    
    // Big Arrows (Lucide)
    { icon: ArrowBigUp, name: 'arrow-big-up', color: '#16a085' },
    { icon: ArrowBigDown, name: 'arrow-big-down', color: '#16a085' },
    { icon: ArrowBigLeft, name: 'arrow-big-left', color: '#16a085' },
    { icon: ArrowBigRight, name: 'arrow-big-right', color: '#16a085' },
  ]
};

// This function is now imported from the utils folder

export const IconSelector: React.FC<IconSelectorProps> = ({
  onIconSelect,
  onItemCreate,
  userId,
  isOpen,
  onClose
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Popular');
  const [searchTerm, setSearchTerm] = useState('');

  const handleIconClick = async (iconData: any) => {
    try {
      // Convert icon to SVG using the proper client-side method
      const svgString = await iconToSvgClient(iconData.icon, {
        size: 64,
        color: iconData.color
      });
      
      // Create a data URL for the SVG
      const dataUrl = svgToDataUrl(svgString);
      
      // Create a new dreamboard item
      const newItem: Database["public"]["Tables"]["dreamboard_items"]["Insert"] = {
        user_id: userId,
        type: 'image', // We'll treat icons as images
        content: JSON.stringify({
          type: 'icon',
          svg: svgString,
          url: dataUrl, // Add the data URL for Konva to use
          iconName: iconData.name,
          color: iconData.color,
          width: 64,
          height: 64
        }),
        title: `Icon: ${iconData.name}`,
        position_x: 100,
        position_y: 100,
        z_index: 1,
      };

      await onItemCreate(newItem);
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error adding icon:', error);
    }
  };

  // Filter icons based on search term
  const getFilteredIcons = (category: string) => {
    const icons = ICON_COLLECTIONS[category as keyof typeof ICON_COLLECTIONS];
    if (!searchTerm) return icons;
    
    return icons.filter(icon => 
      icon.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute top-16 left-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-20 max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Select Icon</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onClose?.()}
        >
          ×
        </Button>
      </div>

      {/* Search Input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search icons..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {Object.keys(ICON_COLLECTIONS).map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category)}
            className="whitespace-nowrap"
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Icon Grid */}
      <div className="grid grid-cols-8 gap-2 max-h-80 overflow-y-auto">
        {getFilteredIcons(selectedCategory).map((iconData, index) => {
          const IconComponent = iconData.icon;
          return (
            <button
              key={index}
              onClick={() => handleIconClick(iconData)}
              className="p-3 hover:bg-gray-100 rounded-md transition-colors flex items-center justify-center border border-gray-200 hover:border-gray-300 group"
              title={iconData.name}
            >
              <IconComponent 
                size={24} 
                color={iconData.color}
                className="group-hover:scale-110 transition-transform" 
              />
            </button>
          );
        })}
      </div>

      {/* Icon Count Display */}
      <div className="mt-3 text-xs text-gray-500 text-center">
        {getFilteredIcons(selectedCategory).length} icons in {selectedCategory}
        {searchTerm && ` (filtered by "${searchTerm}")`}
      </div>
      
      {/* Usage Tip */}
      <div className="mt-2 text-xs text-gray-500 text-center">
        Click an icon to add it to the canvas • Use search to find specific icons
      </div>
    </div>
  );
}; 