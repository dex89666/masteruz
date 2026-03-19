import { icons, LucideIcon } from 'lucide-react';

interface CategoryIconProps {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  sm: { icon: 18, wrapper: 'w-9 h-9' },
  md: { icon: 24, wrapper: 'w-12 h-12' },
  lg: { icon: 32, wrapper: 'w-16 h-16' },
  xl: { icon: 40, wrapper: 'w-20 h-20' },
};

const GRADIENT_MAP: Record<string, string> = {
  Hammer: 'from-orange-400 to-orange-600',
  HardHat: 'from-yellow-400 to-amber-600',
  Home: 'from-sky-400 to-blue-600',
  Armchair: 'from-purple-400 to-purple-600',
  Zap: 'from-amber-300 to-yellow-500',
  Truck: 'from-emerald-400 to-green-600',
  Wrench: 'from-blue-400 to-blue-600',
  Paintbrush: 'from-pink-400 to-rose-600',
  DoorOpen: 'from-teal-400 to-teal-600',
  Plug: 'from-violet-400 to-violet-600',
  TreePine: 'from-lime-400 to-green-600',
  SprayCan: 'from-cyan-400 to-cyan-600',
  Leaf: 'from-green-400 to-emerald-600',
  Building2: 'from-slate-400 to-slate-600',
  Palette: 'from-fuchsia-400 to-fuchsia-600',
  Sofa: 'from-amber-400 to-amber-600',
  Blocks: 'from-stone-400 to-stone-600',
  Snowflake: 'from-sky-300 to-blue-500',
  Monitor: 'from-indigo-400 to-indigo-600',
  Bath: 'from-cyan-300 to-blue-500',
  Flame: 'from-red-400 to-orange-600',
  Fish: 'from-blue-300 to-cyan-500',
};

const DEFAULT_GRADIENT = 'from-gray-400 to-gray-600';

export default function CategoryIcon({ name, size = 'md', className = '' }: CategoryIconProps) {
  const IconComponent = (icons as Record<string, LucideIcon>)[name];
  const { icon: iconSize, wrapper } = SIZE_MAP[size];
  const gradient = GRADIENT_MAP[name] || DEFAULT_GRADIENT;

  if (!IconComponent) {
    return (
      <div className={`${wrapper} rounded-2xl bg-gradient-to-br ${DEFAULT_GRADIENT} flex items-center justify-center shadow-lg ${className}`}>
        <span className="text-white font-bold" style={{ fontSize: iconSize * 0.6 }}>?</span>
      </div>
    );
  }

  return (
    <div className={`${wrapper} rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg ${className}`}>
      <IconComponent size={iconSize} className="text-white drop-shadow-sm" strokeWidth={1.8} />
    </div>
  );
}
