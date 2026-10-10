import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { useLocation } from '../src/modules/location/hooks/useLocation';
import { useAddress } from '../src/modules/profile/context/AddressContext';
import { useWishlist } from '../src/modules/products/context/WishlistContext';

describe('Resilient Context Fallback Tests', () => {
  it('useLocation returns safe fallback values without throwing when outside LocationProvider', () => {
    let captured: any;
    const TestComponent = () => {
      captured = useLocation();
      return null;
    };

    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(<TestComponent />);
    });

    expect(captured).toBeDefined();
    expect(captured.location).toBeDefined();
    expect(captured.location.isLiveGps).toBe(false);
    expect(typeof captured.fetchLiveGpsLocation).toBe('function');
  });

  it('useAddress returns safe fallback values without throwing when outside AddressProvider', () => {
    let captured: any;
    const TestComponent = () => {
      captured = useAddress();
      return null;
    };

    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(<TestComponent />);
    });

    expect(captured).toBeDefined();
    expect(captured.addresses).toEqual([]);
    expect(captured.loading).toBe(false);
    expect(typeof captured.refreshAddresses).toBe('function');
  });

  it('useWishlist returns safe fallback values without throwing when outside WishlistProvider', () => {
    let captured: any;
    const TestComponent = () => {
      captured = useWishlist();
      return null;
    };

    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(<TestComponent />);
    });

    expect(captured).toBeDefined();
    expect(captured.wishlist).toEqual([]);
    expect(captured.wishlistCount).toBe(0);
    expect(typeof captured.addToWishlist).toBe('function');
  });
});
