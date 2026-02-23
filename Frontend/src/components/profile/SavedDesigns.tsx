import { Link } from 'react-router-dom';
import { Palette, Trash2, ShoppingCart, Share2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useFeatureConfig } from '@/lib/featureConfig';
import { ShirtCustomization } from '@/lib/types';

interface SavedDesignsProps {
  designs: ShirtCustomization[];
  onDelete: (id: string) => void;
  onAddToCart: (design: ShirtCustomization) => void;
}

export const SavedDesigns = ({ designs, onDelete, onAddToCart }: SavedDesignsProps) => {
  const { toast } = useToast();
  const { comingSoonEnabled } = useFeatureConfig();

  const handleShare = (design: ShirtCustomization) => {
    // Mock share functionality
    navigator.clipboard.writeText(`${window.location.origin}/customize?design=${design.id}`);
    toast({
      title: 'Link Copied',
      description: 'Design link has been copied to clipboard.',
    });
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    toast({
      title: 'Design Deleted',
      description: 'Your saved design has been removed.',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Saved Designs
          </CardTitle>
          {comingSoonEnabled && (
            <Badge variant="secondary" className="text-xs font-normal">
              Coming Soon
            </Badge>
          )}
        </div>
        <CardDescription>Your custom shirt designs</CardDescription>
      </CardHeader>
      <CardContent>
        {designs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Palette className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No saved designs yet</p>
            <p className="text-sm mb-4">Create your first custom design</p>
            {comingSoonEnabled ? (
              <div className="flex flex-col items-center gap-2">
                <Button disabled className="opacity-80 cursor-not-allowed">
                  Start Designing
                </Button>
                <Badge variant="secondary" className="text-xs font-normal">
                  Coming Soon
                </Badge>
              </div>
            ) : (
              <Link to="/customize">
                <Button>Start Designing</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 ${comingSoonEnabled ? 'pointer-events-none opacity-90' : ''}`}>
            {designs.map((design) => (
              <div key={design.id} className="border rounded-lg overflow-hidden">
                {/* Design Preview */}
                <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                  <div className="text-center">
                    <div 
                      className="w-16 h-20 mx-auto rounded-t-full border-4 mb-2"
                      style={{ 
                        backgroundColor: design.bodyColor,
                        borderColor: design.collarColor 
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      {design.elements.length} elements
                    </p>
                  </div>
                </div>
                {/* Design Info & Actions */}
                <div className="p-3 space-y-2">
                  <div className="flex gap-1">
                    <div 
                      className="w-6 h-6 rounded-full border" 
                      style={{ backgroundColor: design.bodyColor }}
                      title="Body"
                    />
                    <div 
                      className="w-6 h-6 rounded-full border" 
                      style={{ backgroundColor: design.collarColor }}
                      title="Collar"
                    />
                    <div 
                      className="w-6 h-6 rounded-full border" 
                      style={{ backgroundColor: design.sleeveColor }}
                      title="Sleeves"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handleShare(design)}
                      disabled={comingSoonEnabled}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="flex-1"
                      onClick={() => onAddToCart(design)}
                      disabled={comingSoonEnabled}
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(design.id)}
                      disabled={comingSoonEnabled}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
