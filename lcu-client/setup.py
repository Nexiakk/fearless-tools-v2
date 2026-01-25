#!/usr/bin/env python3
"""
Setup script for Fearless Tools LCU Client
"""

from setuptools import setup, find_packages
import os

# Read README
with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

# Read requirements
with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="fearless-tools-lcu-client",
    version="1.0.0",
    author="Fearless Tools",
    description="LCU client for monitoring League of Legends champion select and sending data to Firestore",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/Nexiakk/fearless-tools-v2",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Games/Entertainment",
        "Topic :: Internet :: WWW/HTTP",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    python_requires=">=3.8",
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "lcu-client=main:main",
        ],
    },
    keywords="league-of-legends lcu champion-select monitoring firestore",
    project_urls={
        "Bug Reports": "https://github.com/Nexiakk/fearless-tools-v2/issues",
        "Source": "https://github.com/Nexiakk/fearless-tools-v2",
    },
    include_package_data=True,
    zip_safe=False,
)
