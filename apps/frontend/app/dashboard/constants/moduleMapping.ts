import {
  BookOpen,
  ClipboardCheck,
  Target,
  TrendingUp,
  CalendarRange,
  Sparkles,
  Banknote,
  Clock,
  Calendar,
  MapPin,
  ListChecks,
  Brush,
  FolderOpen,
  Plane,
  Brain,
  Network,
  FileText,
} from "lucide-react";

// Product ID to Module mapping
export const PRODUCT_ID_TO_MODULE = {
  // Add your actual Stripe product IDs here
  prod_annual_calendar: {
    href: "/annual_calendar_plans",
    title: "Annual Calendar Plans",
    description:
      "Plan and organize your yearly calendar with long-term goals and milestones.",
    icon: Calendar,
    borderColor: "border-cyan-400",
    iconColor: "text-cyan-500",
    statusKey: null,
  },
  prod_SOXVOY4Y01eEEg: {
    href: "/journaling",
    title: "Daily Journal",
    description:
      "Record your thoughts and reflections with guided journal prompts.",
    icon: BookOpen,
    borderColor: "border-yellow-400",
    iconColor: "text-yellow-500",
    statusKey: "daily_journal_completed" as const,
  },
  prod_ai_journal: {
    href: "/ai-journal",
    title: "Let Me In",
    description:
      "Your mental clarity zone. Let AI guide your thoughts, organize your mind, and unlock new insights.",
    icon: Brain,
    borderColor: "border-purple-400",
    iconColor: "text-purple-500",
    statusKey: null,
  },
  prod_SSHxJIydFNnuGR: {
    href: "/weekly-rhythms",
    title: "Weekly Rhythms",
    description:
      "Plan and review your weekly priorities and rhythms for better focus.",
    icon: CalendarRange,
    borderColor: "border-green-400",
    iconColor: "text-green-500",
    statusKey: "weekly_rhythm_completed" as const,
  },
  prod_SOXp10vcmKFrWL: {
    href: "/habit-tracker",
    title: "Habit Tracker",
    description:
      "Track your daily habits and build consistency with a visual tracker.",
    icon: Target,
    borderColor: "border-red-400",
    iconColor: "text-red-500",
    statusKey: "habit_tracker_completed" as const,
  },
  // 'prod_calendar': {
  //   href: '/calendar',
  //   title: 'Calendar',
  //   description: 'View and manage your schedule with Google Calendar integration.',
  //   icon: Calendar,
  //   borderColor: 'border-cyan-400',
  //   iconColor: 'text-cyan-500',
  //   statusKey: null
  // },
  // 'prod_map': {
  //   href: '/map',
  //   title: 'Map',
  //   description: 'Access maps and location services with Google Maps integration.',
  //   icon: MapPin,
  //   borderColor: 'border-emerald-400',
  //   iconColor: 'text-emerald-500',
  //   statusKey: null
  // },
  prod_todo: {
    href: "/todo",
    title: "To-do List",
    description: "A simple and easy-to-use to-do list, like a piece of paper.",
    icon: ClipboardCheck,
    borderColor: "border-blue-400",
    iconColor: "text-blue-500",
    statusKey: null,
  },
  prod_manifestation: {
    href: "/manifestation",
    title: "Manifestation",
    description: "Set intentions and track your manifestation journey.",
    icon: Sparkles,
    borderColor: "border-purple-400",
    iconColor: "text-purple-500",
    statusKey: null,
  },
  prod_personal_finance: {
    href: "/personal-finance",
    title: "Personal Finance",
    description: "Track income, expenses, and manage your budget.",
    icon: Banknote,
    borderColor: "border-teal-400",
    iconColor: "text-teal-500",
    statusKey: null,
  },
  prod_travel_pl: {
    href: "/travel-pl",
    title: "Travel P&L",
    description: "Track your travel expenses and profit/loss by destination.",
    icon: Plane,
    borderColor: "border-sky-400",
    iconColor: "text-sky-500",
    statusKey: null,
  },
  prod_five_percent_reviews: {
    href: "/five-percent-reviews",
    title: "Five Percent Reviews",
    description: "Track and review your progress with 5% improvement goals.",
    icon: TrendingUp,
    borderColor: "border-indigo-400",
    iconColor: "text-indigo-500",
    statusKey: null,
  },
  prod_futureme: {
    href: "/futureme",
    title: "Future Me",
    description: "Send letters to your future self for reflection and growth.",
    icon: Clock,
    borderColor: "border-orange-400",
    iconColor: "text-orange-500",
    statusKey: null,
  },
  prod_weekly_design_system: {
    href: "/weekly-design-system",
    title: "Weekly Design System",
    description:
      "Plan and track your weekly activities with a structured time-based system.",
    icon: CalendarRange,
    borderColor: "border-blue-400",
    iconColor: "text-blue-500",
    statusKey: null,
  },
  prod_bucket_list: {
    href: "/bucket-list",
    title: "Bucket List",
    description:
      "Create and manage your life goals and dreams organized by category.",
    icon: ListChecks,
    borderColor: "border-pink-400",
    iconColor: "text-pink-500",
    statusKey: null,
  },
  prod_ikigai: {
    href: "/ikigai",
    title: "Ikigai",
    description:
      "Discover your life's purpose by exploring what you love, what you're good at, what the world needs, and what you can be paid for.",
    icon: Target,
    borderColor: "border-rose-400",
    iconColor: "text-rose-500",
    statusKey: null,
  },
  prod_dreamboard: {
    href: "/dreamboard",
    title: "Dreamboard",
    description:
      "Create a visual dream board with drawings, text, and images. Drag and arrange elements to visualize your goals and aspirations.",
    icon: Brush,
    borderColor: "border-violet-400",
    iconColor: "text-violet-500",
    statusKey: null,
  },
  prod_project: {
    href: "/project",
    title: "Project Management",
    description:
      "Organize and track your projects from start to finish with task management and progress tracking.",
    icon: FolderOpen,
    borderColor: "border-sky-400",
    iconColor: "text-sky-500",
    statusKey: null,
  },
  prod_mindmap: {
    href: "/mindmap",
    title: "Mindmap",
    description:
      "Create interactive mind maps to visualize ideas, brainstorm, and organize your thoughts.",
    icon: Network,
    borderColor: "border-amber-400",
    iconColor: "text-amber-500",
    statusKey: null,
  },
  prod_oppp: {
    href: "/oppp",
    title: "One-Page Personal Plan",
    description:
      "Create a comprehensive one-page personal plan covering relationships, achievements, rituals, and wealth goals.",
    icon: FileText,
    borderColor: "border-emerald-400",
    iconColor: "text-emerald-500",
    statusKey: null,
  },
} as const;

// Admin users who can see all modules
export const ADMIN_EMAILS = [
  "tanengkeen@gmail.com",
  "czy199162@gmail.com",
  "ethankiau@gmail.com",
  "ianlim5@gmail.com",
  "eng@autolabkit.com",
  "ethankiau0@gmail.com",
  "serranoerika47@gmail.com",
  "sinmunlow@gmail.com",
  "chanziwei@gmail.com",
  "engatiwork@gmail.com",
  "nmyahmuekhin@gmail.com",
] as const;

// All modules configuration (for admin view)
export const ALL_MODULES = [
  {
    href: "/annual_calendar_plans",
    title: "Annual Calendar Plans",
    description:
      "Plan and organize your yearly calendar with long-term goals and milestones.",
    icon: Calendar,
    borderColor: "border-cyan-400",
    iconColor: "text-cyan-500",
    statusKey: null,
  },
  {
    href: "/journaling",
    title: "Daily Journal",
    description:
      "Record your thoughts and reflections with guided journal prompts.",
    icon: BookOpen,
    borderColor: "border-yellow-400",
    iconColor: "text-yellow-500",
    statusKey: "daily_journal_completed" as const,
  },
  {
    href: "/ai-journal",
    title: "Let Me In",
    description:
      "Your mental clarity zone. Let AI guide your thoughts, organize your mind, and unlock new insights.",
    icon: Brain,
    borderColor: "border-purple-400",
    iconColor: "text-purple-500",
    statusKey: null,
  },
  {
    href: "/weekly-rhythms",
    title: "Weekly Rhythms",
    description:
      "Plan and review your weekly priorities and rhythms for better focus.",
    icon: CalendarRange,
    borderColor: "border-green-400",
    iconColor: "text-green-500",
    statusKey: "weekly_rhythm_completed" as const,
  },
  // {
  //   href: '/calendar',
  //   title: 'Calendar',
  //   description: 'View and manage your schedule with Google Calendar integration.',
  //   icon: Calendar,
  //   borderColor: 'border-cyan-400',
  //   iconColor: 'text-cyan-500',
  //   statusKey: null
  // },
  // {
  //   href: '/map',
  //   title: 'Map',
  //   description: 'Access maps and location services with Google Maps integration.',
  //   icon: MapPin,
  //   borderColor: 'border-emerald-400',
  //   iconColor: 'text-emerald-500',
  //   statusKey: null
  // },
  {
    href: "/todo",
    title: "To-do List",
    description: "A simple and easy-to-use to-do list, like a piece of paper.",
    icon: ClipboardCheck,
    borderColor: "border-blue-400",
    iconColor: "text-blue-500",
    statusKey: null,
  },
  {
    href: "/habit-tracker",
    title: "Habit Tracker",
    description:
      "Track your daily habits and build consistency with a visual tracker.",
    icon: Target,
    borderColor: "border-red-400",
    iconColor: "text-red-500",
    statusKey: "habit_tracker_completed" as const,
  },
  {
    href: "/manifestation",
    title: "Manifestation",
    description: "Set intentions and track your manifestation journey.",
    icon: Sparkles,
    borderColor: "border-purple-400",
    iconColor: "text-purple-500",
    statusKey: null,
  },
  {
    href: "/personal-finance",
    title: "Personal Finance",
    description: "Track income, expenses, and manage your budget.",
    icon: Banknote,
    borderColor: "border-teal-400",
    iconColor: "text-teal-500",
    statusKey: null,
  },
  {
    href: "/travel-pl",
    title: "Travel P&L",
    description: "Track your travel expenses and profit/loss by destination.",
    icon: Plane,
    borderColor: "border-sky-400",
    iconColor: "text-sky-500",
    statusKey: null,
  },
  {
    href: "/five-percent-reviews",
    title: "Five Percent Reviews",
    description: "Track and review your progress with 5% improvement goals.",
    icon: TrendingUp,
    borderColor: "border-indigo-400",
    iconColor: "text-indigo-500",
    statusKey: null,
  },
  {
    href: "/futureme",
    title: "Future Me",
    description: "Send letters to your future self for reflection and growth.",
    icon: Clock,
    borderColor: "border-orange-400",
    iconColor: "text-orange-500",
    statusKey: null,
  },
  {
    href: "/weekly-design-system",
    title: "Weekly Design System",
    description:
      "Plan and track your weekly activities with a structured time-based system.",
    icon: CalendarRange,
    borderColor: "border-blue-400",
    iconColor: "text-blue-500",
    statusKey: null,
  },
  {
    href: "/bucket-list",
    title: "Bucket List",
    description:
      "Create and manage your life goals and dreams organized by category.",
    icon: ListChecks,
    borderColor: "border-pink-400",
    iconColor: "text-pink-500",
    statusKey: null,
  },
  {
    href: "/ikigai",
    title: "Ikigai",
    description:
      "Discover your life's purpose by exploring what you love, what you're good at, what the world needs, and what you can be paid for.",
    icon: Target,
    borderColor: "border-rose-400",
    iconColor: "text-rose-500",
    statusKey: null,
  },
  {
    href: "/dreamboard",
    title: "Dreamboard",
    description:
      "Create a visual dream board with drawings, text, and images. Drag and arrange elements to visualize your goals and aspirations.",
    icon: Brush,
    borderColor: "border-violet-400",
    iconColor: "text-violet-500",
    statusKey: null,
  },
  {
    href: "/project",
    title: "Project Management",
    description:
      "Organize and track your projects from start to finish with task management and progress tracking.",
    icon: FolderOpen,
    borderColor: "border-sky-400",
    iconColor: "text-sky-500",
    statusKey: null,
  },
  {
    href: "/mindmap",
    title: "Mindmap",
    description:
      "Create interactive mind maps to visualize ideas, brainstorm, and organize your thoughts.",
    icon: Network,
    borderColor: "border-amber-400",
    iconColor: "text-amber-500",
    statusKey: null,
  },
  {
    href: "/oppp",
    title: "One-Page Personal Plan",
    description:
      "Create a comprehensive one-page personal plan covering relationships, achievements, rituals, and wealth goals.",
    icon: FileText,
    borderColor: "border-emerald-400",
    iconColor: "text-emerald-500",
    statusKey: null,
  },
] as const;

export type ModuleStatusKey =
  | "daily_journal_completed"
  | "weekly_rhythm_completed"
  | "habit_tracker_completed";
