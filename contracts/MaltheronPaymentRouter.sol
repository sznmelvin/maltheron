// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MaltheronPaymentRouter
 * @dev Relayer contract that splits incoming USDC payments:
 *      - 99.9% to recipient
 *      - 0.1% to treasury (fee)
 */
contract MaltheronPaymentRouter is Ownable {
    IERC20 public immutable usdc;
    
    // Fee: 10 basis points = 0.1%
    uint256 public constant FEE_BPS = 10;
    
    // Treasury wallet where fees are sent
    address public treasuryWallet;
    
    // Events
    event PaymentReceived(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 fee
    );
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    
    /**
     * @dev Constructor
     * @param _usdc USDC token address on the chain
     * @param _treasury Wallet address to receive fees
     */
    constructor(address _usdc, address _treasury) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_treasury != address(0), "Invalid treasury address");
        
        usdc = IERC20(_usdc);
        treasuryWallet = _treasury;
    }
    
    /**
     * @dev Update treasury wallet address
     * @param _newTreasury New treasury address
     */
    function setTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid treasury address");
        emit TreasuryUpdated(treasuryWallet, _newTreasury);
        treasuryWallet = _newTreasury;
    }
    
    /**
     * @dev Get the fee amount for a given payment amount
     * @param _amount Original payment amount
     * @return fee Amount of USDC that goes to treasury
     */
    function getFeeAmount(uint256 _amount) public pure returns (uint256) {
        return (_amount * FEE_BPS) / 10000;
    }
    
    /**
     * @dev Withdraw accidentally sent tokens (except USDC)
     * @param _token Token address to withdraw
     * @param _amount Amount to withdraw
     */
    function rescueToken(address _token, uint256 _amount) external onlyOwner {
        require(_token != address(usdc), "Cannot rescue USDC");
        IERC20(_token).transfer(owner(), _amount);
    }
    
    /**
     * @dev Withdraw accumulated USDC fees to treasury
     */
    function withdrawFees() external {
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No fees to withdraw");
        usdc.transfer(treasuryWallet, balance);
    }
    
    // Function to receive USDC deposits
    // Users send USDC here, it auto-splits based on the data
    receive() external payable {
        revert("Use transferAndSplit function");
    }
    
    /**
     * @dev Main entry point for payments
     * @param _from Payer address
     * @param _to Recipient address
     * @param _amount Amount of USDC (in USDC decimals)
     */
    function processPayment(
        address _from,
        address _to,
        uint256 _amount
    ) external {
        require(_from != address(0), "Invalid from address");
        require(_to != address(0), "Invalid to address");
        require(_amount > 0, "Amount must be > 0");
        
        // Calculate fee
        uint256 fee = getFeeAmount(_amount);
        uint256 netAmount = _amount - fee;
        
        // Transfer fee to treasury
        if (fee > 0) {
            usdc.transferFrom(_from, treasuryWallet, fee);
        }
        
        // Transfer net amount to recipient
        usdc.transferFrom(_from, _to, netAmount);
        
        emit PaymentReceived(_from, _to, _amount, fee);
    }
    
    /**
     * @dev Simpler version for users who already sent USDC to contract
     * @param _to Recipient address
     * @param _totalAmount Total amount sent to contract (including fee)
     */
    function splitPayment(address _to, uint256 _totalAmount) external {
        require(_to != address(0), "Invalid to address");
        require(_totalAmount > 0, "Amount must be > 0");
        
        uint256 fee = getFeeAmount(_totalAmount);
        uint256 netAmount = _totalAmount - fee;
        
        uint256 contractBalance = usdc.balanceOf(address(this));
        require(contractBalance >= _totalAmount, "Insufficient balance");
        
        // Send fee to treasury
        if (fee > 0) {
            usdc.transfer(treasuryWallet, fee);
        }
        
        // Send net to recipient
        usdc.transfer(_to, netAmount);
        
        emit PaymentReceived(msg.sender, _to, _totalAmount, fee);
    }
}
