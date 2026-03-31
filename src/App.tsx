/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Menu, 
  ShoppingCart, 
  Clock, 
  MapPin, 
  ChevronRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  TrendingUp, 
  Package, 
  Truck, 
  CreditCard, 
  FileText,
  Scissors,
  Bone,
  HeartPulse,
  Scan,
  Baby,
  Stethoscope,
  ClipboardList,
  User as UserIcon,
  MessageCircle,
  Download,
  LayoutDashboard,
  X,
  ShieldCheck,
  Wallet,
  Check,
  Smartphone,
  Banknote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CATEGORIES, PRODUCTS, SURGERY_KITS, SurgeryKit } from './constants';
import { Product, Category, Order } from './types';

import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, type User, handleFirestoreError, OperationType } from './firebase';
import { doc, setDoc, getDoc, collection, query, where, onSnapshot, orderBy, serverTimestamp, updateDoc } from 'firebase/firestore';

// --- Components ---

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const ProductImage = ({ src, alt, className }: { src?: string | null; alt: string; className?: string }) => {
  if (!src) {
    return (
      <div className={`bg-gray-100 animate-pulse flex items-center justify-center ${className}`}>
        <Package className="w-1/3 h-1/3 text-gray-300" />
      </div>
    );
  }
  return (
    <img 
      src={src} 
      alt={alt} 
      className={className} 
      referrerPolicy="no-referrer" 
    />
  );
};

const ProductDetail = ({ product, onClose, onAdd, generatedImage }: { product: Product; onClose: () => void; onAdd: (p: Product) => void; generatedImage?: string | null }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      className="fixed inset-0 z-[60] bg-white flex flex-col"
    >
      <div className="relative h-[40vh] bg-gray-50">
        <ProductImage 
          src={generatedImage} 
          alt={product.name} 
          className="w-full h-full object-contain" 
        />
        <button 
          onClick={onClose}
          className="absolute top-4 left-4 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg"
        >
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        <div className="space-y-2">
          <div className="flex justify-between items-start">
            <h2 className="text-2xl font-black text-gray-900">{product.name}</h2>
            <span className="text-2xl font-black text-blue-600">{product.price.toFixed(2)} MAD</span>
          </div>
          <p className="text-sm text-gray-500 font-medium">{product.manufacturer} • Réf: {product.id.padStart(4, '0')}</p>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Stock</p>
            <p className={`text-sm font-bold ${product.stockStatus === 'low' ? 'text-red-500' : 'text-green-600'}`}>
              {product.stockCount} unités
            </p>
          </div>
          <div className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase">DLC</p>
            <p className="text-sm font-bold text-gray-900">{product.dlc}</p>
          </div>
          <div className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Remboursé</p>
            <p className="text-sm font-bold text-gray-900">{product.isReimbursed ? 'OUI' : 'NON'}</p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-bold text-gray-900">Description</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {product.description || "Aucune description disponible pour ce produit."}
          </p>
        </div>

        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <p className="text-xs text-blue-800 leading-tight">
            Ce produit est conforme aux normes de sécurité internationales et certifié pour un usage en milieu hospitalier au Maroc.
          </p>
        </div>
      </div>

      <div className="p-4 border-t border-gray-100">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            onAdd(product);
            onClose();
          }}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-200 flex items-center justify-center gap-3"
        >
          AJOUTER AU PANIER
          <ShoppingCart className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );
};

const KitDetail = ({ kit, onClose, onAdd, generatedImages }: { kit: SurgeryKit; onClose: () => void; onAdd: (kit: SurgeryKit, selectedProductIds: string[]) => void; generatedImages: Record<string, string> }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(kit.products);

  const toggleProduct = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const kitProducts = kit.products.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean) as Product[];
  const totalPrice = kitProducts.filter(p => selectedIds.includes(p.id)).reduce((acc, p) => acc + p.price, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      className="fixed inset-0 z-[60] bg-white flex flex-col"
    >
      <div className="relative h-[30vh] bg-blue-600 p-8 flex flex-col justify-end">
        <button 
          onClick={onClose}
          className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur-sm rounded-full shadow-lg text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="space-y-2">
          <div className="bg-white/20 w-fit px-2 py-1 rounded-lg text-[10px] font-bold text-white uppercase tracking-wider">Pack Optimisé par IA</div>
          <h2 className="text-3xl font-black text-white leading-tight">{kit.name}</h2>
          <p className="text-blue-100 text-sm font-medium">{kit.description}</p>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-gray-900">Contenu du Pack</h3>
          <span className="text-xs text-gray-500 font-medium">{selectedIds.length} / {kit.products.length} sélectionnés</span>
        </div>

        <div className="space-y-3">
          {kitProducts.map(product => (
            <div 
              key={product.id}
              onClick={() => toggleProduct(product.id)}
              className={`p-3 rounded-2xl border transition-all flex items-center gap-4 cursor-pointer ${selectedIds.includes(product.id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 opacity-60'}`}
            >
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0">
                <ProductImage src={generatedImages[product.id]} alt={product.name} className="w-full h-full object-contain" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{product.name}</p>
                <p className="text-[10px] text-gray-500 font-medium">{product.manufacturer}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-gray-900">{product.price.toFixed(2)} MAD</p>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedIds.includes(product.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-200'}`}>
                  {selectedIds.includes(product.id) && <Check className="w-3 h-3 text-white" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-gray-100 space-y-4 bg-gray-50">
        <div className="flex justify-between items-center px-2">
          <span className="text-gray-500 font-medium text-sm">Total du Pack Modifié</span>
          <span className="text-2xl font-black text-gray-900">{totalPrice.toFixed(2)} MAD</span>
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          disabled={selectedIds.length === 0}
          onClick={() => {
            onAdd(kit, selectedIds);
            onClose();
          }}
          className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl flex items-center justify-center gap-3 transition-all ${selectedIds.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' : 'bg-blue-600 text-white shadow-blue-200'}`}
        >
          AJOUTER LE PACK AU PANIER
          <Package className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );
};

const IconMap: Record<string, any> = {
  Scissors,
  Bone,
  HeartPulse,
  Scan,
  Baby,
  Stethoscope,
  ClipboardList
};

const Header = ({ title, onBack, onCart, cartCount, onProfile, user }: { title: string; onBack?: () => void; onCart?: () => void; cartCount?: number; onProfile?: () => void; user?: User | null }) => (
  <header className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
    <div className="flex items-center gap-3">
      {onBack ? (
        <button onClick={onBack} className="p-1 hover:bg-gray-50 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-blue-600" />
        </button>
      ) : (
        <div className="bg-blue-600 p-1.5 rounded-lg">
          <Truck className="w-5 h-5 text-white" />
        </div>
      )}
      <h1 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h1>
    </div>
    <div className="flex items-center gap-3">
      {onCart && (
        <button onClick={onCart} className="relative p-2 hover:bg-gray-50 rounded-full transition-colors">
          <ShoppingCart className="w-6 h-6 text-gray-700" />
          {cartCount && cartCount > 0 ? (
            <span className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
              {cartCount}
            </span>
          ) : null}
        </button>
      )}
      <button 
        onClick={onProfile}
        className="p-1 hover:bg-gray-50 rounded-full transition-colors overflow-hidden border border-gray-100"
      >
        {user?.photoURL ? (
          <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="p-1.5">
            <UserIcon className="w-6 h-6 text-gray-700" />
          </div>
        )}
      </button>
    </div>
  </header>
);

const Portal = ({ onLogin }: { onLogin: () => void }) => (
  <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-8 text-center">
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="space-y-8 max-w-sm w-full"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="bg-blue-600 p-6 rounded-[2.5rem] shadow-2xl shadow-blue-200">
          <Truck className="w-16 h-16 text-white" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">MediRush</h1>
          <p className="text-gray-500 font-medium">Logistique Médicale d'Urgence</p>
        </div>
      </div>

      <div className="space-y-4 pt-8">
        <p className="text-sm text-gray-400 px-4">Connectez-vous pour accéder à votre inventaire et commander en urgence.</p>
        <button 
          onClick={onLogin}
          className="w-full py-4 bg-white border-2 border-gray-100 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-all shadow-sm group"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          <span className="font-bold text-gray-700 group-hover:text-blue-600">Continuer avec Google</span>
        </button>
      </div>

      <div className="pt-12 flex flex-col gap-2 opacity-30">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Partenaire de confiance</p>
        <div className="flex justify-center gap-4">
          <div className="w-8 h-8 bg-gray-200 rounded-full" />
          <div className="w-8 h-8 bg-gray-200 rounded-full" />
          <div className="w-8 h-8 bg-gray-200 rounded-full" />
        </div>
      </div>
    </motion.div>
  </div>
);

const Profile = ({ user, onLogout, onBack }: { user: User; onLogout: () => void; onBack: () => void }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20 }}
    className="flex flex-col h-full bg-gray-50"
  >
    <Header title="Mon Profil" onBack={onBack} />
    
    <div className="flex-1 px-4 py-8 space-y-8 overflow-y-auto">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="relative">
          <img 
            src={user.photoURL || ''} 
            alt={user.displayName || ''} 
            className="w-24 h-24 rounded-full border-4 border-white shadow-xl object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 border-4 border-white rounded-full" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-gray-900">{user.displayName}</h2>
          <p className="text-gray-500 font-medium">{user.email}</p>
        </div>
        <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
          Compte Professionnel
        </span>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Paramètres</p>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <button className="w-full p-4 flex items-center justify-between border-b border-gray-50 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-bold text-gray-700">Adresses de livraison</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>
          <button className="w-full p-4 flex items-center justify-between border-b border-gray-50 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-lg">
                <CreditCard className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-sm font-bold text-gray-700">Moyens de paiement</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>
          <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-bold text-gray-700">Notifications</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>
        </div>
      </div>

      <button 
        onClick={onLogout}
        className="w-full py-4 bg-red-50 text-red-600 font-bold rounded-2xl border border-red-100 flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
      >
        <X className="w-5 h-5" />
        DÉCONNEXION
      </button>
    </div>
  </motion.div>
);

const CategoryCard = ({ category, onClick }: { category: Category; onClick: () => void; key?: string | number }) => {
  const Icon = IconMap[category.icon] || ClipboardList;
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
    >
      <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
      <span className="text-xs font-semibold text-gray-700 text-center">{category.name}</span>
    </motion.button>
  );
};

const ProductItem = ({ product, onAdd, onClick, generatedImage }: { product: Product; onAdd: (p: Product) => void; onClick: () => void; generatedImage?: string | null; key?: string | number }) => {
  const isExpiringSoon = new Date(product.dlc) < new Date('2026-05-01');

  return (
    <div 
      onClick={onClick}
      className="bg-white p-4 rounded-2xl border border-gray-100 flex gap-4 shadow-sm cursor-pointer hover:border-blue-200 transition-colors"
    >
      <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gray-50 border border-gray-100">
        <ProductImage src={generatedImage} alt={product.name} className="w-full h-full object-contain" />
        {isExpiringSoon && (
          <div className="absolute top-1 left-1 bg-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase">
            DLC Proche
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-gray-900 leading-tight">{product.name}</h3>
            <span className="text-blue-600 font-bold">{product.price.toFixed(2)} MAD</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{product.manufacturer} • Réf: {product.id.padStart(4, '0')}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className={`w-2 h-2 rounded-full ${
              product.stockStatus === 'high' ? 'bg-green-500' : 
              product.stockStatus === 'medium' ? 'bg-orange-500' : 'bg-red-500'
            }`} />
            <span className="text-[10px] font-medium text-gray-600">
              {product.stockStatus === 'high' ? 'Stock optimal' : 
               product.stockStatus === 'medium' ? 'Stock limité' : 'Urgence réappro'}
            </span>
          </div>
        </div>
        <div className="flex justify-between items-end mt-2">
          <div className="text-[10px] text-gray-400">DLC: {product.dlc}</div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onAdd(product)}
            className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

// --- Payment Component ---
const Payment = ({ order, onConfirm, onBack }: { order: Order; onConfirm: (method: string) => void; onBack: () => void }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string>('cash');

  const handlePay = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onConfirm(selectedMethod);
    }, 2000);
  };

  const paymentMethods = [
    { id: 'cash', label: 'Espèces', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
    { id: 'card', label: 'TPE Mobile', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'apple', label: 'Apple Pay', icon: Smartphone, color: 'text-black', bg: 'bg-gray-50' },
    { id: 'google', label: 'Google Pay', icon: Smartphone, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'check', label: 'Chèque', icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  const steps = [
    { id: 1, label: 'Récapitulatif', icon: ClipboardList },
    { id: 2, label: 'Livraison', icon: Truck },
    { id: 3, label: 'Paiement', icon: Wallet },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex flex-col h-full bg-gray-50"
    >
      <div className="p-4 bg-white border-b border-gray-100">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={step === 1 ? onBack : () => setStep((step - 1) as any)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-xl font-black text-gray-900">Finalisation</h1>
        </div>

        {/* Progress Bar */}
        <div className="flex justify-between relative px-2">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-100 -translate-y-1/2 z-0" />
          {steps.map((s) => {
            const Icon = s.icon;
            const isActive = step >= s.id;
            const isCurrent = step === s.id;
            return (
              <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-gray-300 border border-gray-100'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-[8px] font-bold uppercase tracking-wider ${isCurrent ? 'text-blue-600' : 'text-gray-400'}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <h2 className="text-xs font-bold text-gray-400 uppercase mb-3">Résumé de la commande</h2>
                <div className="space-y-3">
                  {order.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-gray-100 rounded flex items-center justify-center text-[10px] font-bold text-gray-500">{item.quantity}x</span>
                        <span className="text-gray-700 font-medium truncate max-w-[150px]">{item.product?.name || item.name}</span>
                      </div>
                      <span className="font-bold text-gray-900">{(item.price * item.quantity).toFixed(2)} MAD</span>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-gray-50 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Total Articles</span>
                      <span className="font-bold text-gray-900">{order.totalPrice.toFixed(2)} MAD</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Prise en charge</span>
                      <span className="font-bold text-green-600">-{order.reimbursedAmount.toFixed(2)} MAD</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-xl shadow-blue-100">
                <p className="text-xs font-bold opacity-60 uppercase tracking-widest mb-1">Total à payer</p>
                <p className="text-3xl font-black">{order.patientAmount.toFixed(2)} MAD</p>
              </div>

              <button 
                onClick={() => setStep(2)}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-200 flex items-center justify-center gap-3"
              >
                CONTINUER VERS LA LIVRAISON
                <ArrowLeft className="w-5 h-5 rotate-180" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <h2 className="text-xs font-bold text-gray-400 uppercase mb-1">Informations de Livraison</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Adresse par défaut</p>
                      <p className="text-xs text-gray-500">123 Rue de la Santé, Casablanca, Maroc</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <Clock className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Mode de livraison</p>
                      <p className="text-xs text-gray-500">
                        {order.deliveryType === 'express' ? 'Express (45 min)' : order.deliveryType === 'night' ? 'Nuit' : `Programmé (${order.deliverySlot})`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <Wallet className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Mode de paiement</p>
                      <p className="text-xs text-gray-500">
                        {paymentMethods.find(m => m.id === selectedMethod)?.label || 'À la livraison'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <h2 className="text-xs font-bold text-gray-400 uppercase mb-3">Détails du destinataire</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Nom Complet</label>
                    <p className="text-sm font-bold text-gray-900">Dr. Anass Rhomari</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Téléphone</label>
                    <p className="text-sm font-bold text-gray-900">+212 6 00 00 00 00</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setStep(3)}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-200 flex items-center justify-center gap-3"
              >
                CONFIRMER LA COMMANDE
                <ArrowLeft className="w-5 h-5 rotate-180" />
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <h2 className="text-xs font-bold text-gray-400 uppercase mb-3">Méthode de paiement</h2>
                  <div className="space-y-2">
                    {paymentMethods.map((method) => {
                      const Icon = method.icon;
                      const isSelected = selectedMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          onClick={() => setSelectedMethod(method.id)}
                          className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${method.bg} ${method.color}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <span className={`text-sm font-bold ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>{method.label}</span>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-200'}`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-xl shadow-blue-100">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold opacity-60 uppercase tracking-widest">Total à régler</p>
                    <p className="text-2xl font-black">{order.patientAmount.toFixed(2)} MAD</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center space-y-4">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                    <Truck className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-gray-900">
                      {selectedMethod === 'cash' ? 'Paiement en Espèces' : 
                       selectedMethod === 'card' ? 'Paiement par TPE' : 
                       selectedMethod === 'check' ? 'Paiement par Chèque' : 
                       'Paiement Mobile'}
                    </h2>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {selectedMethod === 'cash' ? 'Préparez le montant exact pour faciliter la remise.' : 
                       selectedMethod === 'card' ? 'Le livreur disposera d\'un terminal de paiement mobile.' : 
                       selectedMethod === 'check' ? 'Chèque à l\'ordre de MediRush.' : 
                       'Validez la transaction sur votre téléphone lors de la livraison.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-gray-400">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] font-medium uppercase tracking-wider">Commande enregistrée sur votre compte professionnel</span>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handlePay}
                disabled={isProcessing}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-200 flex items-center justify-center gap-3 disabled:bg-blue-300"
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ENREGISTREMENT...
                  </>
                ) : (
                  <>
                    VALIDER LA COMMANDE
                    <CheckCircle2 className="w-5 h-5" />
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [view, setView] = useState<'home' | 'category' | 'cart' | 'tracking' | 'dashboard' | 'invoices' | 'profile' | 'payment'>('home');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedKit, setSelectedKit] = useState<SurgeryKit | null>(null);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [pastOrders, setPastOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deliveryType, setDeliveryType] = useState<'express' | 'scheduled' | 'night'>('express');
  const [deliverySlot, setDeliverySlot] = useState('14:00 - 15:00');
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        // Create/Update user profile in Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || null,
              photoURL: currentUser.photoURL || null,
              role: 'user',
              createdAt: serverTimestamp()
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync Orders from Firestore
  useEffect(() => {
    if (!user) {
      setPastOrders([]);
      return;
    }

    const ordersRef = collection(db, 'users', user.uid, 'orders');
    const q = query(ordersRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          date: data.date?.toDate?.()?.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) || data.date
        } as Order;
      });
      setPastOrders(orders);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/orders`);
    });

    return () => unsubscribe();
  }, [user]);

  // Background image generation
  useEffect(() => {
    const generateImages = async () => {
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 5000; // 5 seconds base delay for retries

      for (const product of PRODUCTS) {
        let retries = 0;
        let success = false;

        while (retries < MAX_RETRIES && !success) {
          try {
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: {
                parts: [
                  {
                    text: `A professional, high-quality studio photograph of a medical supply: ${product.name}. Clean white background, sterile environment, realistic lighting, 4k resolution.`,
                  },
                ],
              },
            });
            
            for (const part of response.candidates?.[0]?.content?.parts || []) {
              if (part.inlineData) {
                setGeneratedImages(prev => ({
                  ...prev,
                  [product.id]: `data:image/png;base64,${part.inlineData.data}`
                }));
                success = true;
                break;
              }
            }
            
            // Wait between successful requests to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 3000));
            
          } catch (error: any) {
            const errorMsg = error?.message || '';
            const isRateLimit = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED');
            
            if (isRateLimit && retries < MAX_RETRIES - 1) {
              retries++;
              const backoff = RETRY_DELAY * Math.pow(2, retries - 1);
              console.warn(`Rate limit hit for ${product.name}. Retrying in ${backoff}ms... (Attempt ${retries}/${MAX_RETRIES})`);
              await new Promise(resolve => setTimeout(resolve, backoff));
            } else {
              console.error(`Image generation failed for ${product.name}:`, error);
              break; // Stop retrying for this product
            }
          }
        }
      }
    };

    generateImages();
  }, []);

  const timeSlots = ['08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00'];

  // Simulation of real-time tracking
  useEffect(() => {
    if (activeOrder && activeOrder.status !== 'delivered') {
      const timer = setTimeout(() => {
        const statuses: Order['status'][] = ['received', 'preparing', 'on_way', 'delivered'];
        const currentIndex = statuses.indexOf(activeOrder.status);
        if (currentIndex < statuses.length - 1) {
          const updatedOrder: Order = {
            ...activeOrder,
            status: statuses[currentIndex + 1],
            eta: Math.max(0, activeOrder.eta - 10)
          };
          setActiveOrder(updatedOrder);
          if (updatedOrder.status === 'delivered') {
            setPastOrders(prev => [updatedOrder, ...prev]);
          }
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeOrder]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const addKitToCart = (kit: SurgeryKit, selectedProductIds?: string[]) => {
    const idsToUse = selectedProductIds || kit.products;
    idsToUse.forEach(productId => {
      const product = PRODUCTS.find(p => p.id === productId);
      if (product) {
        addToCart(product);
      }
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const cartReimbursed = cart.reduce((acc, item) => acc + (item.product.isReimbursed ? item.product.price * item.quantity : 0), 0);
  const cartPatient = cartTotal - cartReimbursed;
  
  const pastOrdersTotal = pastOrders.reduce((acc, order) => acc + (order.totalPrice || 0), 0);
  const pastOrdersPaidTotal = pastOrders.filter(o => o.paymentStatus === 'paid').reduce((acc, order) => acc + (order.totalPrice || 0), 0);
  const pastOrdersUnpaidTotal = pastOrders.filter(o => o.paymentStatus === 'unpaid').reduce((acc, order) => acc + (order.totalPrice || 0), 0);

  const updateOrderPaymentStatus = async (orderId: string, newStatus: 'paid' | 'unpaid') => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'orders', orderId), {
        paymentStatus: newStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/orders/${orderId}`);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('home');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleCheckout = async () => {
    if (!user) return;

    const orderId = Math.random().toString(36).substr(2, 9).toUpperCase();
    const orderData = {
      id: orderId,
      uid: user.uid,
      status: 'received',
      paymentStatus: 'unpaid',
      eta: deliveryType === 'express' ? 45 : 0,
      items: cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
        name: item.product.name
      })),
      totalPrice: cartTotal,
      reimbursedAmount: cartReimbursed,
      patientAmount: cartPatient,
      deliveryType: deliveryType,
      deliverySlot: deliveryType === 'scheduled' ? deliverySlot : null,
      courierName: 'Ahmed K.',
      date: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'users', user.uid, 'orders', orderId), orderData);
      setActiveOrder({
        ...orderData,
        date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
        items: cart // Keep full product objects for UI
      } as Order);
      setCart([]);
      setView('payment');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/orders/${orderId}`);
    }
  };

  const generateInvoicePDF = (order: Order) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235); // blue-600
    doc.text('MediRush', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('On-demand Medical Supply Delivery', 14, 26);
    doc.text('Casablanca, Maroc', 14, 31);
    
    // Invoice Info
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text(`FACTURE #${order.id}`, 14, 45);
    
    doc.setFontSize(10);
    doc.text(`Date: ${order.date}`, 14, 52);
    doc.text(`Mode de livraison: ${order.deliveryType.toUpperCase()}`, 14, 57);
    if (order.deliverySlot) {
      doc.text(`Créneau: ${order.deliverySlot}`, 14, 62);
    }
    if (order.paymentMethod) {
      const methodLabel = order.paymentMethod === 'cash' ? 'Espèces' : 
                          order.paymentMethod === 'card' ? 'TPE Mobile' : 
                          order.paymentMethod === 'apple' ? 'Apple Pay' : 
                          order.paymentMethod === 'google' ? 'Google Pay' : 
                          order.paymentMethod === 'check' ? 'Chèque' : order.paymentMethod;
      doc.text(`Mode de paiement: ${methodLabel}`, 14, order.deliverySlot ? 67 : 62);
    }
    
    // Table
    const tableData = order.items.map(item => {
      // Handle both full product objects and simplified Firestore items
      const name = item.product?.name || (item as any).name || 'Produit';
      const price = item.product?.price || (item as any).price || 0;
      return [
        name,
        item.quantity.toString(),
        `${price.toFixed(2)} MAD`,
        `${(price * item.quantity).toFixed(2)} MAD`
      ];
    });
    
    autoTable(doc, {
      startY: 80,
      head: [['Produit', 'Qté', 'Prix Unitaire', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
    });
    
    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(12);
    doc.text(`Total TTC: ${order.totalPrice.toFixed(2)} MAD`, 140, finalY);
    
    doc.setFontSize(10);
    doc.setTextColor(37, 99, 235);
    doc.text(`Pris en charge: ${order.reimbursedAmount.toFixed(2)} MAD`, 140, finalY + 7);
    
    doc.setTextColor(100);
    doc.text(`Reste à charge: ${order.patientAmount.toFixed(2)} MAD`, 140, finalY + 14);
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Merci de votre confiance. MediRush - Votre partenaire santé.', 14, 285);
    
    doc.save(`Facture_MediRush_${order.id}.pdf`);
  };

  const filteredProducts = useMemo(() => {
    let list = PRODUCTS;
    if (selectedCategory) {
      list = list.filter(p => p.category === selectedCategory.id);
    }
    if (searchQuery) {
      list = list.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return list;
  }, [selectedCategory, searchQuery]);

  if (!isAuthReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Portal onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20 max-w-md mx-auto shadow-2xl relative overflow-hidden">
      <AnimatePresence mode="wait">
        {/* --- HOME VIEW --- */}
        {view === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col h-full"
          >
            <Header 
              title="MediRush" 
              onCart={() => setView('cart')} 
              cartCount={cart.length}
              onProfile={() => setView('profile')}
              user={user}
            />
            
            <div className="px-4 py-6 space-y-8">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un consommable..."
                  className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Delivery Banner */}
              <div className="bg-blue-600 rounded-2xl p-4 text-white flex items-center justify-between shadow-lg shadow-blue-200">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-medium opacity-80">Livraison estimée</p>
                    <p className="text-lg font-bold">45 min • Express</p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 opacity-50" />
              </div>

              {/* Categories Grid */}
              <section>
                <div className="flex justify-between items-end mb-4">
                  <h2 className="text-lg font-bold">Catégories</h2>
                  <button className="text-blue-600 text-sm font-semibold">Voir tout</button>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {CATEGORIES.slice(0, 7).map(cat => (
                    <CategoryCard 
                      key={cat.id} 
                      category={cat} 
                      onClick={() => {
                        setSelectedCategory(cat);
                        setView('category');
                      }} 
                    />
                  ))}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    className="flex flex-col items-center gap-2 p-3 bg-gray-100 rounded-2xl border border-dashed border-gray-300"
                  >
                    <div className="w-12 h-12 flex items-center justify-center">
                      <Menu className="w-6 h-6 text-gray-400" />
                    </div>
                    <span className="text-xs font-semibold text-gray-400">Plus</span>
                  </motion.button>
                </div>
              </section>

              {/* Recent Orders / Quick Reorder */}
              <section>
                <div className="flex justify-between items-end mb-4">
                  <h2 className="text-lg font-bold">Commander à nouveau</h2>
                  <History className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {PRODUCTS.slice(0, 3).map(product => (
                    <motion.div
                      key={product.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedProduct(product)}
                      className="min-w-[140px] bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3 cursor-pointer hover:border-blue-100 transition-colors"
                    >
                      <div className="w-full aspect-square bg-gray-50 rounded-xl overflow-hidden border border-gray-50">
                        <ProductImage src={generatedImages[product.id]} alt={product.name} className="w-full h-full object-contain" />
                      </div>
                      <p className="text-xs font-bold text-gray-800 line-clamp-2 min-h-[2.5rem] flex items-center">{product.name}</p>
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(product);
                        }}
                        className="w-full py-2 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg hover:bg-blue-100 transition-colors mt-auto"
                      >
                        RECOMMANDER
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              </section>
            </div>
          </motion.div>
        )}

        {/* --- CATEGORY VIEW --- */}
        {view === 'category' && (
          <motion.div
            key="category"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full"
          >
            <Header 
              title={selectedCategory?.name || "Produits"} 
              onBack={() => {
                setView('home');
                setSelectedCategory(null);
              }} 
              onCart={() => setView('cart')}
              cartCount={cart.length}
              onProfile={() => setView('profile')}
              user={user}
            />
            
            <div className="px-4 py-6 space-y-6">
              {selectedCategory?.id === 'surgery' && (
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-600 p-1.5 rounded-lg">
                      <LayoutDashboard className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="text-lg font-bold">Kits Proposés par l'IA</h2>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                    {SURGERY_KITS.map(kit => (
                      <motion.div
                        key={kit.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedKit(kit)}
                        className="min-w-[240px] bg-blue-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-200 relative overflow-hidden group cursor-pointer"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-all" />
                        <div className="relative z-10 space-y-3">
                          <div className="flex justify-between items-start">
                            <h3 className="font-bold text-sm leading-tight pr-4">{kit.name}</h3>
                            <div className="bg-white/20 px-2 py-1 rounded-lg text-[10px] font-bold">PACK IA</div>
                          </div>
                          <p className="text-[10px] opacity-80 line-clamp-2">{kit.description}</p>
                          <div className="space-y-1">
                            <p className="text-[8px] font-bold opacity-60 uppercase tracking-tighter">Contenu du pack:</p>
                            <div className="flex flex-wrap gap-1">
                              {kit.products.slice(0, 3).map(id => {
                                const p = PRODUCTS.find(prod => prod.id === id);
                                return p ? (
                                  <span key={id} className="text-[8px] bg-white/10 px-1 py-0.5 rounded border border-white/10 whitespace-nowrap">
                                    {p.name}
                                  </span>
                                ) : null;
                              })}
                              {kit.products.length > 3 && (
                                <span className="text-[8px] opacity-60">+{kit.products.length - 3} autres</span>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between items-end pt-2">
                            <div>
                              <p className="text-[10px] opacity-60 uppercase font-bold tracking-wider">Prix du pack</p>
                              <p className="text-lg font-black">{kit.price.toFixed(2)} MAD</p>
                            </div>
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedKit(kit);
                              }}
                              className="bg-white text-blue-600 px-3 py-2 rounded-xl text-[10px] font-bold shadow-sm"
                            >
                              DÉTAILLER / MODIFIER
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-500 font-medium">{filteredProducts.length} produits trouvés</p>
                  <div className="flex gap-2">
                    <button className="p-2 bg-white border border-gray-100 rounded-lg shadow-sm">
                      <TrendingUp className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                {filteredProducts.map(product => (
                  <ProductItem 
                    key={product.id} 
                    product={product} 
                    generatedImage={generatedImages[product.id]}
                    onAdd={(p) => {
                      addToCart(p);
                    }} 
                    onClick={() => setSelectedProduct(product)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* --- PRODUCT DETAIL OVERLAY --- */}
        <AnimatePresence>
          {selectedProduct && (
            <ProductDetail 
              product={selectedProduct} 
              generatedImage={generatedImages[selectedProduct.id]}
              onClose={() => setSelectedProduct(null)} 
              onAdd={addToCart} 
            />
          )}
        </AnimatePresence>

        {/* --- KIT DETAIL OVERLAY --- */}
        <AnimatePresence>
          {selectedKit && (
            <KitDetail 
              kit={selectedKit} 
              generatedImages={generatedImages}
              onClose={() => setSelectedKit(null)} 
              onAdd={addKitToCart} 
            />
          )}
        </AnimatePresence>

        {/* --- CART VIEW --- */}
        {view === 'cart' && (
          <motion.div
            key="cart"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col h-full"
          >
            <Header title="Votre Panier" onBack={() => setView('home')} onProfile={() => setView('profile')} user={user} />
            
            <div className="flex-1 px-4 py-6 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                  <ShoppingCart className="w-16 h-16 text-gray-300" />
                  <p className="font-medium text-gray-500">Votre panier est vide</p>
                  <button 
                    onClick={() => setView('home')}
                    className="text-blue-600 font-bold"
                  >
                    Commencer mes achats
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.product.id} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                          <ProductImage src={generatedImages[item.product.id]} alt={item.product.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold">{item.product.name}</p>
                          <p className="text-xs text-gray-500">{item.quantity} x {item.product.price.toFixed(2)} MAD</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-sm">{(item.product.price * item.quantity).toFixed(2)} MAD</span>
                          <button onClick={() => removeFromCart(item.product.id)} className="text-red-500 p-1">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Split Billing Section */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4 shadow-sm">
                    <h3 className="font-bold flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      Répartition Facturation
                    </h3>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                        <div>
                          <p className="text-xs font-bold text-blue-800 uppercase">Dossier Pris en Charge</p>
                          <p className="text-[10px] text-blue-600">Facturation directe Organisme</p>
                        </div>
                        <span className="text-lg font-black text-blue-800">{cartReimbursed.toFixed(2)} MAD</span>
                      </div>
                      
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div>
                          <p className="text-xs font-bold text-gray-800 uppercase">Sous-Dossier Extra</p>
                          <p className="text-[10px] text-gray-500">Compensation Patient</p>
                        </div>
                        <span className="text-lg font-black text-gray-800">{cartPatient.toFixed(2)} MAD</span>
                      </div>

                      <div className="flex justify-between items-center p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-100">
                        <div>
                          <p className="text-xs font-bold text-white uppercase">Total TTC</p>
                          <p className="text-[10px] text-blue-100">Montant global de la commande</p>
                        </div>
                        <span className="text-xl font-black text-white">{cartTotal.toFixed(2)} MAD</span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Options */}
                  <div className="space-y-4">
                    <h3 className="font-bold">Mode de livraison</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <button 
                        onClick={() => setDeliveryType('express')}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${deliveryType === 'express' ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-100 text-gray-500'}`}
                      >
                        <Truck className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Express</span>
                      </button>
                      <button 
                        onClick={() => setDeliveryType('scheduled')}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${deliveryType === 'scheduled' ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-100 text-gray-500'}`}
                      >
                        <Clock className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Programmé</span>
                      </button>
                      <button 
                        onClick={() => setDeliveryType('night')}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${deliveryType === 'night' ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-100 text-gray-500'}`}
                      >
                        <MapPin className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Nuit</span>
                      </button>
                    </div>

                    {deliveryType === 'scheduled' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-2"
                      >
                        <p className="text-xs font-bold text-gray-400 uppercase">Choisir un créneau</p>
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                          {timeSlots.map(slot => (
                            <button
                              key={slot}
                              onClick={() => setDeliverySlot(slot)}
                              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${deliverySlot === slot ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-white border border-gray-100 text-gray-500'}`}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-4 bg-white border-t border-gray-100 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Total Commande</span>
                  <span className="text-2xl font-black text-gray-900">{cartTotal.toFixed(2)} MAD</span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCheckout}
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-200 flex items-center justify-center gap-3"
                >
                  CONFIRMER LA COMMANDE
                  <ChevronRight className="w-5 h-5" />
                </motion.button>
              </div>
            )}
          </motion.div>
        )}

        {/* --- TRACKING VIEW --- */}
        {view === 'tracking' && activeOrder && (
          <motion.div
            key="tracking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full bg-white"
          >
            <Header title="Suivi Livraison" onBack={() => setView('home')} onProfile={() => setView('profile')} user={user} />
            <div className="relative h-[40vh] bg-gray-200">
              {/* Simulated Map */}
              <div className="absolute inset-0 grayscale opacity-40">
                <iframe 
                  width="100%" 
                  height="100%" 
                  frameBorder="0" 
                  scrolling="no" 
                  marginHeight={0} 
                  marginWidth={0} 
                  src="https://maps.google.com/maps?width=100%25&height=600&hl=en&q=Casablanca,Morocco&t=&z=14&ie=UTF8&iwloc=B&output=embed"
                  title="Livraison Map"
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center"
                  >
                    <div className="w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-lg" />
                  </motion.div>
                  <div className="absolute -top-12 -left-1/2 bg-white px-3 py-1 rounded-full shadow-md text-[10px] font-bold whitespace-nowrap">
                    Livreur à 2.4 km
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 -mt-6 bg-white rounded-t-[32px] p-6 shadow-2xl relative z-10 space-y-6 overflow-y-auto">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">
                    {activeOrder.deliveryType === 'scheduled' ? `Livraison prévue à ${activeOrder.deliverySlot}` : `Arrivée dans ${activeOrder.eta} min`}
                  </h2>
                  <div className="flex justify-between items-end">
                    <p className="text-gray-500 text-sm">Commande #{activeOrder.id} • {activeOrder.deliveryType === 'express' ? 'Express' : activeOrder.deliveryType === 'night' ? 'Nuit' : 'Programmé'}</p>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Total Payé</p>
                      <p className="text-lg font-black text-blue-600">{activeOrder.totalPrice.toFixed(2)} MAD</p>
                    </div>
                  </div>
                </div>
                <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-green-700 rounded-full animate-pulse" />
                  EN ROUTE
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-6">
                {[
                  { id: 'received', label: 'Commande reçue', time: '10:02', done: true },
                  { id: 'preparing', label: 'Préparation en cours', time: '10:05', done: ['preparing', 'on_way', 'delivered'].includes(activeOrder.status) },
                  { id: 'on_way', label: 'Livreur en route', time: '10:12', done: ['on_way', 'delivered'].includes(activeOrder.status) },
                  { id: 'delivered', label: 'Livré & Signé', time: '--:--', done: activeOrder.status === 'delivered' }
                ].map((step, idx, arr) => (
                  <div key={step.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step.done ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-300'}`}>
                        {step.done ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-2 h-2 bg-current rounded-full" />}
                      </div>
                      {idx < arr.length - 1 && (
                        <div className={`w-0.5 h-10 ${step.done ? 'bg-blue-600' : 'bg-gray-100'}`} />
                      )}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <div className="flex justify-between items-center">
                        <p className={`text-sm font-bold ${step.done ? 'text-gray-900' : 'text-gray-300'}`}>{step.label}</p>
                        <span className="text-[10px] text-gray-400 font-medium">{step.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Courier Info */}
              <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                    <img src="https://picsum.photos/seed/courier/100/100" alt="Courier" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{activeOrder.courierName}</p>
                    <div className="flex items-center gap-1">
                      <div className="flex text-yellow-400">
                        {[1, 2, 3, 4, 5].map(s => <TrendingUp key={s} className="w-2 h-2 fill-current" />)}
                      </div>
                      <span className="text-[10px] text-gray-500 font-bold">4.9 (120 livraisons)</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 text-blue-600">
                    <MessageCircle className="w-5 h-5" />
                  </button>
                  <button className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 text-blue-600">
                    <Truck className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <button 
                onClick={() => generateInvoicePDF(activeOrder)}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-blue-100"
              >
                <Download className="w-5 h-5" />
                TÉLÉCHARGER LA FACTURE (PDF)
              </button>
            </div>
          </motion.div>
        )}

        {/* --- DASHBOARD VIEW --- */}
        {view === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col h-full"
          >
            <Header title="Gestion MediRush" onBack={() => setView('home')} onProfile={() => setView('profile')} user={user} />
            
            <div className="px-4 py-6 space-y-6 overflow-y-auto">
              {/* Financial Overview */}
              <section className="space-y-3">
                <h2 className="text-lg font-bold">Tableau de Bord Financier</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-100 col-span-2">
                    <p className="text-[10px] font-bold text-blue-100 uppercase mb-1">Chiffre d'Affaires Total</p>
                    <p className="text-2xl font-black text-white">{pastOrdersTotal.toFixed(2)} MAD</p>
                    <p className="text-[10px] text-blue-200 mt-1 font-medium">Cumul des dossiers Caisse & Patient</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Total Payé</p>
                    <p className="text-xl font-black text-blue-600">{pastOrdersPaidTotal.toFixed(2)} MAD</p>
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-green-500 font-bold">
                      <CheckCircle2 className="w-3 h-3" /> Règlement validé
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Total En Attente</p>
                    <p className="text-xl font-black text-orange-600">{pastOrdersUnpaidTotal.toFixed(2)} MAD</p>
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-orange-500 font-bold">
                      <Clock className="w-3 h-3" /> Facturation différée
                    </div>
                  </div>
                </div>
              </section>

              {/* Stock Alerts */}
              <section className="space-y-3">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold">Alertes Stock & DLC</h2>
                  <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-full">3 ALERTES</span>
                </div>
                <div className="space-y-3">
                  {PRODUCTS.filter(p => p.stockStatus === 'low' || new Date(p.dlc) < new Date('2026-05-01')).map(p => (
                    <div key={p.id} className="bg-white p-4 rounded-2xl border-l-4 border-l-orange-500 shadow-sm flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                          <AlertCircle className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{p.name}</p>
                          <p className="text-[10px] text-gray-500">
                            {p.stockStatus === 'low' ? 'Stock critique: ' + p.stockCount : 'DLC Proche: ' + p.dlc}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => addToCart(p)}
                        className="bg-orange-600 text-white text-[10px] font-bold px-3 py-2 rounded-lg"
                      >
                        COMMANDER
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* Consumption History */}
              <section className="space-y-3">
                <h2 className="text-lg font-bold">Consommation par Spécialité</h2>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
                  {[
                    { label: 'Chirurgie Viscérale', value: 65, color: 'bg-blue-600' },
                    { label: 'Radiologie', value: 45, color: 'bg-blue-400' },
                    { label: 'Urgences', value: 30, color: 'bg-blue-200' }
                  ].map(item => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span>{item.label}</span>
                        <span>{item.value}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${item.value}%` }}
                          className={`h-full ${item.color}`} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </motion.div>
        )}
        {/* --- INVOICES VIEW --- */}
        {view === 'invoices' && (
          <motion.div
            key="invoices"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col h-full bg-gray-50"
          >
            <Header title="Mes Factures" onBack={() => setView('home')} onProfile={() => setView('profile')} user={user} />
            
            <div className="flex-1 px-4 pt-6 pb-52 overflow-y-auto space-y-4">
              {pastOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                  <FileText className="w-16 h-16 text-gray-300" />
                  <p className="font-medium text-gray-500">Aucune facture disponible</p>
                </div>
              ) : (
                pastOrders.map(order => (
                  <div key={order.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-blue-600 uppercase">Facture #{order.id}</p>
                        <p className="text-[10px] text-gray-400">{order.date} • {order.deliveryType === 'express' ? 'Express' : order.deliveryType === 'night' ? 'Nuit' : `Programmé (${order.deliverySlot})`}</p>
                        {order.paymentMethod && (
                          <div className="flex items-center gap-1 mt-1">
                            <Wallet className="w-3 h-3 text-gray-400" />
                            <span className="text-[10px] font-bold text-gray-500 uppercase">
                              {order.paymentMethod === 'cash' ? 'Espèces' : 
                               order.paymentMethod === 'card' ? 'TPE Mobile' : 
                               order.paymentMethod === 'apple' ? 'Apple Pay' : 
                               order.paymentMethod === 'google' ? 'Google Pay' : 
                               order.paymentMethod === 'check' ? 'Chèque' : order.paymentMethod}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => updateOrderPaymentStatus(order.id, order.paymentStatus === 'paid' ? 'unpaid' : 'paid')}
                          className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase transition-all ${
                            order.paymentStatus === 'paid' 
                              ? 'bg-green-100 text-green-600 border border-green-200' 
                              : 'bg-orange-100 text-orange-600 border border-orange-200'
                          }`}
                        >
                          {order.paymentStatus === 'paid' ? 'Payée' : 'Non Payée'}
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-400 uppercase">Répartition</p>
                        <div className="flex gap-3">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-blue-600 rounded-full" />
                            <span className="text-[10px] font-bold text-blue-800">{order.reimbursedAmount.toFixed(2)} MAD</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full" />
                            <span className="text-[10px] font-bold text-gray-800">{order.patientAmount.toFixed(2)} MAD</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 uppercase">Total TTC</p>
                        <p className="text-lg font-black text-gray-900">{order.totalPrice.toFixed(2)} MAD</p>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => generateInvoicePDF(order)}
                      className="w-full py-2 bg-gray-50 text-gray-600 text-xs font-bold rounded-xl border border-gray-100 flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      TÉLÉCHARGER PDF
                    </button>
                  </div>
                ))
              )}
            </div>

            {pastOrders.length > 0 && (
              <div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-40 max-w-md mx-auto">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="bg-green-50 p-3 rounded-2xl border border-green-100">
                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">Total Payé</p>
                    <p className="text-lg font-black text-green-700">{pastOrdersPaidTotal.toFixed(2)} MAD</p>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-2xl border border-orange-100">
                    <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-1">Total En Attente</p>
                    <p className="text-lg font-black text-orange-700">{pastOrdersUnpaidTotal.toFixed(2)} MAD</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Volume Total TTC</span>
                  </div>
                  <span className="text-sm font-black text-gray-900">{pastOrdersTotal.toFixed(2)} MAD</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
        {view === 'payment' && activeOrder && (
          <Payment 
            order={activeOrder} 
            onConfirm={async (method) => {
              if (!user || !activeOrder) return;
              try {
                await updateDoc(doc(db, 'users', user.uid, 'orders', activeOrder.id), {
                  paymentMethod: method
                });
                setActiveOrder({ ...activeOrder, paymentMethod: method });
                setView('tracking');
              } catch (error) {
                handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/orders/${activeOrder.id}`);
              }
            }} 
            onBack={() => setView('cart')} 
          />
        )}

        {view === 'profile' && user && (
          <Profile user={user} onLogout={handleLogout} onBack={() => setView('home')} />
        )}
      </AnimatePresence>

      {/* --- BOTTOM NAVIGATION --- */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50 max-w-md mx-auto">
        <button 
          onClick={() => setView('home')}
          className={`flex flex-col items-center gap-1 ${view === 'home' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <Package className="w-6 h-6" />
          <span className="text-[10px] font-bold">Commander</span>
        </button>
        <button 
          onClick={() => setView('invoices')}
          className={`flex flex-col items-center gap-1 ${view === 'invoices' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <CreditCard className="w-6 h-6" />
          <span className="text-[10px] font-bold">Factures</span>
        </button>
        <button 
          onClick={() => setView('dashboard')}
          className={`flex flex-col items-center gap-1 ${view === 'dashboard' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <TrendingUp className="w-6 h-6" />
          <span className="text-[10px] font-bold">Stats</span>
        </button>
        <button 
          onClick={() => setView('cart')}
          className={`relative flex flex-col items-center gap-1 ${view === 'cart' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <ShoppingCart className="w-6 h-6" />
          <span className="text-[10px] font-bold">Panier</span>
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {cart.length}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
}
