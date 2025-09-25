import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function LayoutTest() {
  return (
    <div className="content-container responsive-padding">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Layout Test - Navigation Overlap Prevention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-100 rounded-lg">
                <h3 className="font-semibold">Mobile Test</h3>
                <p className="text-sm">This should not overlap with mobile nav (pt-16)</p>
              </div>
              <div className="p-4 bg-green-100 rounded-lg">
                <h3 className="font-semibold">Desktop Test</h3>
                <p className="text-sm">This should not overlap with sidebar nav</p>
              </div>
              <div className="p-4 bg-purple-100 rounded-lg">
                <h3 className="font-semibold">Responsive Test</h3>
                <p className="text-sm">This should adapt to all screen sizes</p>
              </div>
            </div>
            
            <div className="p-4 bg-yellow-100 rounded-lg">
              <h3 className="font-semibold mb-2">Screen Size Indicators</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div className="p-2 bg-white rounded border">
                  <strong>Mobile:</strong> &lt; 768px
                </div>
                <div className="p-2 bg-white rounded border">
                  <strong>Tablet:</strong> 768px - 1024px
                </div>
                <div className="p-2 bg-white rounded border">
                  <strong>Desktop:</strong> 1024px - 1280px
                </div>
                <div className="p-2 bg-white rounded border">
                  <strong>Large:</strong> &gt; 1280px
                </div>
              </div>
            </div>

            <div className="p-4 bg-red-100 rounded-lg">
              <h3 className="font-semibold mb-2">Navigation Spacing</h3>
              <ul className="text-sm space-y-1">
                <li>• Mobile: 64px top padding (pt-16)</li>
                <li>• Desktop: Responsive left margin based on nav width</li>
                <li>• Safe areas: Handles notched devices</li>
                <li>• Overflow: Prevents horizontal scrolling</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
