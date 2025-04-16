// ES module version of images-worker

// Handler for incoming requests
export default {
    async fetch(request, env) {
      return await handleRequest(request, env);
    }
  };
  
  // Main request handler
  async function handleRequest(request, env) {
    // Set up CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://vbcloudflare.org',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
  
    // Handle OPTIONS request (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders,
      });
    }
  
    // Get the URL path
    const url = new URL(request.url);
    const path = url.pathname;
  
    // Most endpoints require authentication
    let userId = null;
    if (path !== '/public-images') {
      // Verify JWT token
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ message: 'Unauthorized - Valid token required' }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
  
      const token = authHeader.split(' ')[1];
      
      try {
        // Verify JWT
        const payload = await verifyJWT(token, env);
        userId = payload.userId;
      } catch (error) {
        return new Response(
          JSON.stringify({ message: 'Invalid token', error: error.message }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
    }
  
    // Route requests to appropriate handlers
    try {
      if (path === '/images' && request.method === 'GET') {
        return await handleGetUserImages(userId, env, corsHeaders);
      } else if (path === '/images/upload-url' && request.method === 'GET') {
        return await handleGetUploadUrl(userId, env, corsHeaders);
      } else if (path.match(/^\/images\/[^\/]+\/metadata$/) && request.method === 'PUT') {
        const imageId = path.split('/')[2];
        return await handleUpdateImageMetadata(userId, imageId, request, env, corsHeaders);
      } else if (path.match(/^\/images\/[^\/]+$/) && request.method === 'DELETE') {
        const imageId = path.split('/')[2];
        return await handleDeleteImage(userId, imageId, env, corsHeaders);
      } else if (path === '/public-images' && request.method === 'GET') {
        return await handleGetPublicImages(env, corsHeaders);
      } else {
        return new Response(
          JSON.stringify({ message: 'Not found' }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
    } catch (err) {
      return new Response(
        JSON.stringify({ message: 'Server error', error: err.message }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  }
  
  // Handle get user's images
  async function handleGetUserImages(userId, env, corsHeaders) {
    try {
      // First, check if we need to create the images table
      await ensureImageTableExists(env);
      
      // Get user's images from the database
      const { results } = await env.DB.prepare(`
        SELECT * FROM images 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `).bind(userId).all();
  
      // Add base URL for all images
      const imagesWithUrl = results.map(image => ({
        ...image,
        baseUrl: `https://${env.CLOUDFLARE_IMAGES_HASH}.cloudimg.io`
      }));
  
      return new Response(
        JSON.stringify({ images: imagesWithUrl }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ message: 'Error fetching images', error: error.message }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  }
  
  // Handle get public images
  async function handleGetPublicImages(env, corsHeaders) {
    try {
      // First, check if we need to create the images table
      await ensureImageTableExists(env);
      
      // Get public images from the database
      const { results } = await env.DB.prepare(`
        SELECT * FROM images 
        WHERE is_public = 1
        ORDER BY created_at DESC
        LIMIT 20
      `).all();
  
      // Add base URL for all images
      const imagesWithUrl = results.map(image => ({
        ...image,
        baseUrl: `https://${env.CLOUDFLARE_IMAGES_HASH}.cloudimg.io`
      }));
  
      return new Response(
        JSON.stringify({ images: imagesWithUrl }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ message: 'Error fetching public images', error: error.message }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  }
  
  // Handle get direct upload URL
  async function handleGetUploadUrl(userId, env, corsHeaders) {
    try {
      // Get a direct upload URL from Cloudflare Images API
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/images/v1/direct_upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requireSignedURLs: false,
            metadata: {
              userId: userId.toString()
            }
          })
        }
      );
  
      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to get upload URL from Cloudflare');
      }
  
      // Create a new record in our images table
      await ensureImageTableExists(env);
      
      const now = new Date().toISOString();
      await env.DB.prepare(`
        INSERT INTO images (id, user_id, created_at) 
        VALUES (?, ?, ?)
      `).bind(
        data.result.id,
        userId,
        now
      ).run();
  
      return new Response(
        JSON.stringify({ 
          uploadUrl: data.result.uploadURL,
          imageId: data.result.id
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ message: 'Error getting upload URL', error: error.message }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  }
  
  // Handle update image metadata
  async function handleUpdateImageMetadata(userId, imageId, request, env, corsHeaders) {
    try {
      // Get image data from request
      const { description, isPublic = false } = await request.json();
  
      // Check if image belongs to user
      const { results } = await env.DB.prepare(`
        SELECT * FROM images WHERE id = ? AND user_id = ?
      `).bind(imageId, userId).all();
  
      if (results.length === 0) {
        return new Response(
          JSON.stringify({ message: 'Image not found or unauthorized' }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
  
      // Update metadata in our database
      const now = new Date().toISOString();
      await env.DB.prepare(`
        UPDATE images 
        SET description = ?, is_public = ?, updated_at = ? 
        WHERE id = ?
      `).bind(
        description,
        isPublic ? 1 : 0,
        now,
        imageId
      ).run();
  
      // Update metadata in Cloudflare Images
      const cfResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/images/v1/${imageId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            metadata: {
              userId: userId.toString(),
              description,
              isPublic: isPublic ? 'true' : 'false'
            }
          })
        }
      );
  
      const cfData = await cfResponse.json();
      
      if (!cfData.success) {
        // Log error but continue - our DB is the source of truth
        console.error('Failed to update Cloudflare metadata:', cfData.errors);
      }
  
      return new Response(
        JSON.stringify({ 
          message: 'Image metadata updated successfully',
          image: {
            id: imageId,
            description,
            isPublic
          }
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ message: 'Error updating image metadata', error: error.message }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  }
  
  // Handle delete image
  async function handleDeleteImage(userId, imageId, env, corsHeaders) {
    try {
      // Check if image belongs to user
      const { results } = await env.DB.prepare(`
        SELECT * FROM images WHERE id = ? AND user_id = ?
      `).bind(imageId, userId).all();
  
      if (results.length === 0) {
        return new Response(
          JSON.stringify({ message: 'Image not found or unauthorized' }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
  
      // Delete from Cloudflare Images
      const cfResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/images/v1/${imageId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`
          }
        }
      );
  
      // Delete from our database
      await env.DB.prepare(`
        DELETE FROM images WHERE id = ?
      `).bind(imageId).run();
  
      // If Cloudflare deletion failed, log it but consider the operation successful
      // as we've removed it from our database
      if (cfResponse.status !== 200) {
        console.error('Warning: Failed to delete image from Cloudflare. Status:', cfResponse.status);
      }
  
      return new Response(
        JSON.stringify({ message: 'Image deleted successfully' }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ message: 'Error deleting image', error: error.message }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  }
  
  // Ensure the images table exists
  async function ensureImageTableExists(env) {
    try {
      // Check if table exists
      const { results } = await env.DB.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='images'
      `).all();
  
      if (results.length === 0) {
        // Create table if it doesn't exist
        await env.DB.prepare(`
          CREATE TABLE images (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            description TEXT,
            is_public INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `).run();
  
        // Create indexes
        await env.DB.prepare(`
          CREATE INDEX idx_images_user_id ON images(user_id)
        `).run();
  
        await env.DB.prepare(`
          CREATE INDEX idx_images_is_public ON images(is_public)
        `).run();
      }
    } catch (error) {
      console.error('Error ensuring images table exists:', error);
      throw error;
    }
  }
  
  // Helper: Verify JWT token
  async function verifyJWT(token, env) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    const [encodedHeader, encodedPayload, signature] = parts;
    
    // Verify signature
    const encoder = new TextEncoder();
    const data = encoder.encode(`${encodedHeader}.${encodedPayload}${env.JWT_SECRET}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    if (signature !== expectedSignature) {
      throw new Error('Invalid signature');
    }
    
    // Decode payload
    const payload = JSON.parse(atob(encodedPayload));
    
    // Check if token is expired
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }
    
    return payload;
  }