// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockERC4626Vault
 * @notice Simplified ERC-4626 vault for testing Firelight integration
 * @dev Does NOT implement period-based withdrawals - uses instant redemptions
 */
contract MockERC4626Vault is ERC20 {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;

    constructor(
        address _asset,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {
        asset = IERC20(_asset);
    }

    /// @notice Returns the decimals of the vault token (matches asset)
    function decimals() public view virtual override returns (uint8) {
        return ERC20(address(asset)).decimals();
    }

    /// @notice Total assets in vault
    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    /// @notice Convert assets to shares
    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply();
        return supply == 0 ? assets : (assets * supply) / totalAssets();
    }

    /// @notice Convert shares to assets
    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();
        return supply == 0 ? shares : (shares * totalAssets()) / supply;
    }

    /// @notice Preview deposit (how many shares for assets)
    function previewDeposit(uint256 assets) public view returns (uint256) {
        return convertToShares(assets);
    }

    /// @notice Preview mint (how many assets for shares)
    function previewMint(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();
        return supply == 0 ? shares : ((shares * totalAssets()) / supply) + 1;
    }

    /// @notice Preview withdraw (how many shares to burn for assets)
    function previewWithdraw(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply();
        return supply == 0 ? assets : ((assets * supply) / totalAssets()) + 1;
    }

    /// @notice Preview redeem (how many assets for shares)
    function previewRedeem(uint256 shares) public view returns (uint256) {
        return convertToAssets(shares);
    }

    /// @notice Max deposit (unlimited)
    function maxDeposit(address) public pure returns (uint256) {
        return type(uint256).max;
    }

    /// @notice Max mint (unlimited)
    function maxMint(address) public pure returns (uint256) {
        return type(uint256).max;
    }

    /// @notice Max withdraw (user's share of assets)
    function maxWithdraw(address owner) public view returns (uint256) {
        return convertToAssets(balanceOf(owner));
    }

    /// @notice Max redeem (user's shares)
    function maxRedeem(address owner) public view returns (uint256) {
        return balanceOf(owner);
    }

    /// @notice Deposit assets → receive shares
    function deposit(uint256 assets, address receiver) public returns (uint256) {
        require(assets > 0, "Cannot deposit 0");

        uint256 shares = previewDeposit(assets);

        // Transfer assets from sender
        asset.safeTransferFrom(msg.sender, address(this), assets);

        // Mint shares to receiver
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);

        return shares;
    }

    /// @notice Mint exact shares → deposit calculated assets
    function mint(uint256 shares, address receiver) public returns (uint256) {
        require(shares > 0, "Cannot mint 0");

        uint256 assets = previewMint(shares);

        // Transfer assets from sender
        asset.safeTransferFrom(msg.sender, address(this), assets);

        // Mint shares to receiver
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);

        return assets;
    }

    /// @notice Withdraw assets → burn calculated shares (INSTANT - no period)
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public returns (uint256) {
        require(assets > 0, "Cannot withdraw 0");

        uint256 shares = previewWithdraw(assets);

        // Burn shares
        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }
        _burn(owner, shares);

        // Transfer assets to receiver
        asset.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);

        return shares;
    }

    /// @notice Redeem shares → receive assets (INSTANT - no period)
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public returns (uint256) {
        require(shares > 0, "Cannot redeem 0");

        uint256 assets = previewRedeem(shares);

        // Burn shares
        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }
        _burn(owner, shares);

        // Transfer assets to receiver
        asset.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);

        return assets;
    }

    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed sender,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );
}
