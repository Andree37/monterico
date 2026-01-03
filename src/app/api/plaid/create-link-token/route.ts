import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid';
import { CountryCode, Products } from 'plaid';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: userId || 'user_' + Date.now(),
      },
      client_name: 'Monterico Banking App',
      products: [Products.Transactions],
      country_codes: [CountryCode.Ie, CountryCode.Gb],
      language: 'en',
    });

    return NextResponse.json({
      link_token: response.data.link_token,
      expiration: response.data.expiration,
    });
  } catch (error: any) {
    console.error('Error creating link token:', error);
    return NextResponse.json(
      { error: error.response?.data || error.message },
      { status: 500 }
    );
  }
}
