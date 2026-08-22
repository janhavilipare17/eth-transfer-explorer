import React, { useState, useEffect } from 'react';
import { Card, Container, Row, Col, Button, Table, TableBody, TableHeader, TableRow, TableCell, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function TransferDashboard() {
  const navigate = useNavigate();
  const [address, setAddress] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [data, setData] = useState<any>(null);

  const validateAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

  const handleSearch = async () => {
    if (!validateAddress(address)) {
      setError('Invalid Ethereum address format');
      return;
    }
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch(`/api/transfers/${address}`);
      if (!res.ok) throw new Error('API error');
      const result = await res.json();
      setData(result);
    } catch (e: any) {
      setError('Failed to fetch transfer history: ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" sx={{ py: 2, textAlign: 'center' }}>
        ETH Transfer Explorer
      </Typography>
      <Card sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" component="h6" gutterBottom>
          Enter Ethereum Address:
        </Typography>
        <input
          fullWidth
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x..."
          disabled={loading}
          style={{
            border: '2px solid #000',
            padding: '12px',
            fontSize: '16px',
          }}
        />
        <Button
          variant="contained"
          onClick={handleSearch}
          disabled={loading || !validateAddress(address)}
          style={{
            marginTop: '12px',
            border: '2px solid #000',
            boxShadow: '4px 4px 0px 0px #000000',
            '&:hover': {
              transform: 'translate(4px, 4px)',
              boxShadow: 'none',
            },
          }}
        >
          Search
        </Button>
      </Card>
      {loading && <Typography variant="body1" sx={{ textAlign: 'center' }}>Loading...</Typography>}
      {error && (
        <Card
          sx={{
            p: 2,
            borderColor: 'red',
            bgcolor: 'rgba(255, 0, 0, 0.1)',
          }}
        >
          <Typography color="error" sx={{ p: 2 }}>
            {error}
          </Typography>
        </Card>
      )}
      {data && (
        <Card sx={{ p: 2 }}>
          <Typography variant="h5" sx={{ py: 2 }} style={{ textAlign: 'center' }}>
            Summary Stats
          </Typography>
          <Row sx={{ mb: 1 }}>
            <Col xs={12} sm={3}>Total: {data.summary.totalCount}</Col>
            <Col xs={12} sm={3}>Sent: {data.summary.sentCount}</Col>
            <Col xs={12} sm={3}>Received: {data.summary.receivedCount}</Col>
            <Col xs={12} sm={3}>
              Counterparties: {data.summary.uniqueCounterparties}
            </Col>
          </Row>
          <Typography variant="body2" sx={{ mb: 2 }}>Top Assets:</Typography>
          <ul>
            {data.summary.topAssets.map((a: any, i: number) => (
              <li key={i}>
                {a.asset}: {a.count}
              </li>
            ))}
          </ul>
          <Typography variant="body2" sx={{ mb: 2 }}>Category Breakdown:</Typography>
          <ul>
            <li>External: {data.summary.categoryBreakdown.external}</li>
            <li>Internal: {data.summary.categoryBreakdown.internal}</li>
            <li>ERC20: {data.summary.categoryBreakdown.erc20}</li>
            <li>ERC721: {data.summary.categoryBreakdown.erc721}</li>
            <li>ERC1155: {data.summary.categoryBreakdown.erc1155}</li>
          </ul>
        </Card>
      )}
    </Container>
  );
}