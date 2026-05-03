import React, { useState, useEffect } from 'react';
import { Stock, UserProfile } from '../types';

interface PortfolioProps {
  profile: UserProfile;
  onUpdate: (newProfile: UserProfile) => void;
}

export function Portfolio({ profile, onUpdate }: PortfolioProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingStock, setAddingStock] = useState<any | null>(null);
  const [quantity, setQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');

  const searchStocks = async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/stock/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      searchStocks(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  const handleAddStock = () => {
    if (!addingStock || !quantity || !buyPrice) return;
    
    const qty = parseFloat(quantity);
    const price = parseFloat(buyPrice);
    
    if (isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) return;

    const newStock: Stock = {
      symbol: addingStock.symbol,
      name: addingStock.shortname || addingStock.longname || addingStock.symbol,
      quantity: qty,
      buyPrice: price,
      currentPrice: addingStock.regularMarketPrice || price // Use current price if available from search, else buy price
    };

    const newProfile = { ...profile };
    newProfile.assets.stocks = [...(newProfile.assets.stocks || []), newStock];
    
    onUpdate(newProfile);
    
    setAddingStock(null);
    setQuery('');
    setQuantity('');
    setBuyPrice('');
    setResults([]);
  };

  const removeStock = (index: number) => {
    const newProfile = { ...profile };
    newProfile.assets.stocks = newProfile.assets.stocks.filter((_, i) => i !== index);
    onUpdate(newProfile);
  };

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <div className="profile-section mt-4 pt-4 border-t border-gray-100">
      <h4>Stock Portfolio</h4>
      
      {/* Current Portfolio */}
      <div className="mb-4">
        {(!profile.assets.stocks || profile.assets.stocks.length === 0) ? (
          <div className="profile-row"><span className="key" style={{ color: '#ccc' }}>No stocks added yet.</span></div>
        ) : (
          <div className="space-y-2">
            {profile.assets.stocks.map((stock, i) => {
              const currentVal = stock.quantity * (stock.currentPrice || stock.buyPrice);
              const invested = stock.quantity * stock.buyPrice;
              const profit = currentVal - invested;
              const profitPct = (profit / invested) * 100;
              
              return (
                <div key={i} className="profile-row flex-col items-start gap-1">
                  <div className="flex justify-between w-full">
                    <span className="key font-semibold text-gray-900">{stock.symbol}</span>
                    <div className="flex items-center gap-3">
                      <span className="val">{fmt(currentVal)}</span>
                      <button onClick={() => removeStock(i)} className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer">✕</button>
                    </div>
                  </div>
                  <div className="flex justify-between w-full text-[11px]">
                    <span className="text-gray-500">{stock.quantity} @ {fmt(stock.buyPrice)}</span>
                    <span className={`font-medium ${profit >= 0 ? 'text-[#1a7a4a]' : 'text-[#c0392b]'}`}>
                      {profit >= 0 ? '+' : ''}{fmt(profit)} ({profit >= 0 ? '+' : ''}{profitPct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Stock */}
      <div className="border-t border-gray-100 pt-4">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Add Stock</h4>
        
        {!addingStock ? (
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbol (e.g. RELIANCE.NS, AAPL)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a7a4a]"
            />
            {isSearching && <div className="absolute right-3 top-2.5 text-xs text-gray-400">Searching...</div>}
            
            {results.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {results.map((r, i) => (
                  <div 
                    key={i} 
                    className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                    onClick={() => {
                      setAddingStock(r);
                      setResults([]);
                      setQuery('');
                    }}
                  >
                    <div className="font-semibold text-sm">{r.symbol}</div>
                    <div className="text-xs text-gray-500">{r.shortname || r.longname} ({r.exchDisp})</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#f0faf4] p-3 rounded-lg border border-[#b8ddc8]">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-semibold text-[#1a7a4a]">{addingStock.symbol}</div>
                <div className="text-xs text-gray-600">{addingStock.shortname || addingStock.longname}</div>
              </div>
              <button onClick={() => setAddingStock(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                <input 
                  type="number" 
                  value={quantity} 
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#1a7a4a]"
                  placeholder="e.g. 10"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Buy Price (₹)</label>
                <input 
                  type="number" 
                  value={buyPrice} 
                  onChange={(e) => setBuyPrice(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#1a7a4a]"
                  placeholder="e.g. 2500"
                />
              </div>
            </div>
            
            <button 
              onClick={handleAddStock}
              disabled={!quantity || !buyPrice}
              className="w-full bg-[#1a7a4a] text-white py-1.5 rounded text-sm font-medium disabled:opacity-50"
            >
              Add to Portfolio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
