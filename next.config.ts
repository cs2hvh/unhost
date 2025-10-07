import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'flagsapi.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'assets.ubuntu.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.debian.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'fedoraproject.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'alpinelinux.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'archlinux.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.kali.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.centos.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'rockylinux.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'almalinux.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.opensuse.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.gentoo.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'nowpayments.io',
        port: '',
        pathname: '/**',
        search: '',
      },
    ],
  },
};

export default nextConfig;
